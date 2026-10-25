use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::error::TryRecvError;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

use crate::models::{PlayerStatus, RepeatMode, Track};

/// Comandos enviados da camada de IPC para a thread de áudio.
#[derive(Debug, Clone)]
pub enum Cmd {
    PlayIndex(usize),
    Toggle,
    Play,
    Pause,
    Stop,
    Next,
    Previous,
    Seek(u64),
    SetVolume(f32),
    SetRepeat(RepeatMode),
    CycleRepeat,
    Removed(usize),
    Cleared,
}

/// Estado compartilhado entre os comandos Tauri e a thread de áudio.
///
/// A `OutputStream` do rodio **não é `Send`**, por isso ela (e o `Sink` ativo)
/// vivem exclusivamente dentro da thread criada em [`PlayerHandle::start`].
pub struct PlayerHandle {
    tx: UnboundedSender<Cmd>,
    pub playlist: Arc<Mutex<Vec<Track>>>,
    pub status: Arc<Mutex<PlayerStatus>>,
    pub covers: Arc<Mutex<HashMap<u32, String>>>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl PlayerHandle {
    pub fn start(app: AppHandle) -> Self {
        let playlist = Arc::new(Mutex::new(Vec::new()));
        let status = Arc::new(Mutex::new(PlayerStatus::default()));
        let covers = Arc::new(Mutex::new(HashMap::new()));
        let (tx, rx) = unbounded_channel();

        let thread_playlist = Arc::clone(&playlist);
        let thread_status = Arc::clone(&status);

        if let Err(err) = thread::Builder::new()
            .name("nz-player-engine".to_string())
            .spawn(move || run_engine(app, thread_playlist, thread_status, rx))
        {
            log::error!("falha ao iniciar a thread de áudio: {err}");
        }

        Self {
            tx,
            playlist,
            status,
            covers,
        }
    }

    pub fn send(&self, cmd: Cmd) -> Result<(), String> {
        self.tx
            .send(cmd)
            .map_err(|_| "O motor de áudio não está disponível.".to_string())
    }

    pub fn playlist(&self) -> Vec<Track> {
        lock(&self.playlist).clone()
    }

    pub fn status(&self) -> PlayerStatus {
        lock(&self.status).clone()
    }

    pub fn append(&self, mut tracks: Vec<Track>) -> Vec<Track> {
        if tracks.is_empty() {
            return self.playlist();
        }
        lock(&self.playlist).append(&mut tracks);
        self.playlist()
    }

    pub fn remove(&self, index: usize) -> Vec<Track> {
        {
            let mut playlist = lock(&self.playlist);
            if index < playlist.len() {
                playlist.remove(index);
            }
        }
        let _ = self.send(Cmd::Removed(index));
        self.playlist()
    }

    pub fn clear(&self) -> Vec<Track> {
        lock(&self.playlist).clear();
        let _ = self.send(Cmd::Cleared);
        Vec::new()
    }
}

/* ------------------------------------------------------------------ */
/* Motor de áudio (roda em thread própria)                             */
/* ------------------------------------------------------------------ */

fn run_engine(
    app: AppHandle,
    playlist: Arc<Mutex<Vec<Track>>>,
    status: Arc<Mutex<PlayerStatus>>,
    rx: UnboundedReceiver<Cmd>,
) {
    let (stream, handle) = match OutputStream::try_default() {
        Ok(pair) => pair,
        Err(err) => {
            let message = format!("Não foi possível abrir o dispositivo de áudio: {err}");
            log::error!("{message}");
            let _ = app.emit("player-error", message);
            drain(rx);
            return;
        }
    };

    let sink = match Sink::try_new(&handle) {
        Ok(sink) => sink,
        Err(err) => {
            let message = format!("Não foi possível iniciar a saída de áudio: {err}");
            log::error!("{message}");
            let _ = app.emit("player-error", message);
            drop(stream);
            drain(rx);
            return;
        }
    };

    let mut engine = Engine {
        app,
        playlist,
        status,
        rx,
        _stream: stream,
        handle,
        sink,
        offset_ms: 0,
        active: false,
    };

    engine.run();
}

/// Consome os comandos até a canalização fechar (usada quando o áudio falha).
fn drain(rx: UnboundedReceiver<Cmd>) {
    let mut rx = rx;
    loop {
        match rx.try_recv() {
            Ok(_) => continue,
            Err(TryRecvError::Empty) => thread::sleep(Duration::from_millis(100)),
            Err(TryRecvError::Disconnected) => return,
        }
    }
}

struct Engine {
    app: AppHandle,
    playlist: Arc<Mutex<Vec<Track>>>,
    status: Arc<Mutex<PlayerStatus>>,
    rx: UnboundedReceiver<Cmd>,
    /// Mantém o dispositivo aberto enquanto o player existir.
    _stream: OutputStream,
    handle: OutputStreamHandle,
    sink: Sink,
    /// O que precisa ser somado ao relógio do `Sink` (usado no seek de fallback).
    offset_ms: u64,
    /// Existe uma faixa carregada no `Sink`.
    active: bool,
}

impl Engine {
    fn run(&mut self) {
        loop {
            let mut disconnected = false;
            loop {
                match self.rx.try_recv() {
                    Ok(cmd) => self.handle_cmd(cmd),
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Disconnected) => {
                        disconnected = true;
                        break;
                    }
                }
            }
            if disconnected {
                return;
            }

            self.tick();
            thread::sleep(Duration::from_millis(50));
        }
    }

    fn handle_cmd(&mut self, cmd: Cmd) {
        match cmd {
            Cmd::PlayIndex(index) => {
                self.play_index(index);
            }
            Cmd::Toggle => self.toggle(),
            Cmd::Play => self.resume(),
            Cmd::Pause => self.pause(),
            Cmd::Stop => self.stop(),
            Cmd::Next => self.next(),
            Cmd::Previous => self.previous(),
            Cmd::Seek(ms) => self.seek(ms),
            Cmd::SetVolume(volume) => {
                let volume = volume.clamp(0.0, 1.0);
                self.with_status(|status| status.volume = volume);
                self.sink.set_volume(volume);
            }
            Cmd::SetRepeat(mode) => self.with_status(|status| status.repeat = mode),
            Cmd::CycleRepeat => self.with_status(|status| status.repeat = status.repeat.next()),
            Cmd::Removed(index) => self.on_removed(index),
            Cmd::Cleared => self.stop(),
        }
    }

    /* ---------------------------------------------------------- tick -- */

    fn tick(&mut self) {
        if !self.active {
            return;
        }

        let position = self.sink.get_pos().as_millis() as u64 + self.offset_ms;
        let ended = self.sink.empty() && !self.sink.is_paused();

        self.with_status(|status| status.position_ms = position);

        if ended {
            self.on_track_finished();
        }
    }

    /* ------------------------------------------------------ comandos -- */

    fn toggle(&mut self) {
        if self.read_status(|status| status.playing) {
            self.pause();
        } else {
            self.resume();
        }
    }

    fn resume(&mut self) {
        if self.active {
            self.sink.play();
            self.with_status(|status| status.playing = true);
            return;
        }

        if let Some(index) = self.read_status(|status| status.current_index) {
            if self.play_index(index) {
                return;
            }
        }

        if self.len() > 0 {
            self.play_from(0);
        }
    }

    fn pause(&mut self) {
        if !self.active {
            return;
        }
        self.sink.pause();
        self.with_status(|status| status.playing = false);
    }

    fn stop(&mut self) {
        self.sink.stop();
        self.active = false;
        self.offset_ms = 0;
        self.with_status(|status| {
            status.playing = false;
            status.has_track = false;
            status.current_index = None;
            status.position_ms = 0;
            status.duration_ms = 0;
        });
    }

    fn next(&mut self) {
        let len = self.len();
        if len == 0 {
            return;
        }
        let start = match self.read_status(|status| status.current_index) {
            Some(index) => (index + 1) % len,
            None => 0,
        };
        self.play_from(start);
    }

    fn previous(&mut self) {
        let len = self.len();
        if len == 0 {
            return;
        }
        match self.read_status(|status| (status.current_index, status.position_ms)) {
            (Some(_), position) if position > 3_000 => self.seek(0),
            (Some(index), _) => {
                let start = if index == 0 { len - 1 } else { index - 1 };
                self.play_from(start);
            }
            (None, _) => {
                self.play_from(0);
            }
        }
    }

    fn seek(&mut self, ms: u64) {
        if !self.active {
            return;
        }

        let duration = self.read_status(|status| status.duration_ms);
        let target = if duration > 0 { ms.min(duration) } else { ms };

        if self.sink.try_seek(Duration::from_millis(target)).is_ok() {
            self.offset_ms = 0;
            self.with_status(|status| status.position_ms = target);
            return;
        }

        // Fallback: recarrega o arquivo já posicionado no instante desejado.
        let index = match self.read_status(|status| status.current_index) {
            Some(index) => index,
            None => return,
        };
        let track = match lock(&self.playlist).get(index).cloned() {
            Some(track) => track,
            None => return,
        };

        if self.load(index, &track, target) && !self.read_status(|s| s.playing) {
            self.pause();
        }
    }

    /* ---------------------------------------------------- playback ---- */

    fn play_index(&mut self, index: usize) -> bool {
        let track = match lock(&self.playlist).get(index).cloned() {
            Some(track) => track,
            None => return false,
        };
        self.load(index, &track, 0)
    }

    /// Toca a partir de `start`, pulando arquivos que não puderem ser abertos.
    fn play_from(&mut self, start: usize) -> bool {
        let len = self.len();
        if len == 0 {
            return false;
        }
        let mut index = start % len;
        for _ in 0..len {
            if self.play_index(index) {
                return true;
            }
            index = (index + 1) % len;
        }
        false
    }

    fn load(&mut self, index: usize, track: &Track, start_ms: u64) -> bool {
        let file = match File::open(&track.path) {
            Ok(file) => file,
            Err(err) => {
                self.emit_error(format!("Não foi possível abrir \"{}\": {err}", track.title));
                return false;
            }
        };

        let mut decoder = match Decoder::new(BufReader::new(file)) {
            Ok(decoder) => decoder,
            Err(err) => {
                self.emit_error(format!(
                    "Formato não suportado em \"{}\": {err}",
                    track.title
                ));
                return false;
            }
        };

        let mut duration = decoder
            .total_duration()
            .map(|value| value.as_millis() as u64)
            .unwrap_or(0);
        if duration == 0 {
            duration = track.duration_ms;
        }

        let mut offset = 0u64;
        if start_ms > 0
            && decoder
                .try_seek(Duration::from_millis(start_ms))
                .is_ok()
        {
            offset = start_ms;
        }

        let new_sink = match Sink::try_new(&self.handle) {
            Ok(sink) => sink,
            Err(err) => {
                self.emit_error(format!("Falha ao criar o canal de reprodução: {err}"));
                return false;
            }
        };

        // Trocar o `Sink` encerra imediatamente a faixa anterior.
        self.sink = new_sink;
        self.sink
            .set_volume(self.read_status(|status| status.volume));
        self.sink.append(decoder);
        self.sink.play();

        self.offset_ms = offset;
        self.active = true;

        let position = offset.min(duration);
        self.with_status(|status| {
            status.current_index = Some(index);
            status.has_track = true;
            status.playing = true;
            status.position_ms = position;
            status.duration_ms = duration;
        });

        true
    }

    fn on_track_finished(&mut self) {
        let (current, repeat) = self.read_status(|status| (status.current_index, status.repeat));
        self.active = false;

        let len = self.len();
        let current = match current {
            Some(index) if len > 0 => index % len,
            _ => {
                self.finish();
                return;
            }
        };

        let start = match repeat {
            RepeatMode::One => current,
            RepeatMode::All => (current + 1) % len,
            RepeatMode::Off => {
                if current + 1 < len {
                    current + 1
                } else {
                    self.finish();
                    return;
                }
            }
        };

        if !self.play_from(start) {
            self.finish();
        }
    }

    fn finish(&mut self) {
        self.active = false;
        self.offset_ms = 0;
        self.with_status(|status| {
            status.playing = false;
            status.position_ms = status.duration_ms;
        });
    }

    fn on_removed(&mut self, index: usize) {
        let mut status = lock(&self.status);
        match status.current_index {
            Some(current) if current == index => {
                status.current_index = None;
                status.has_track = false;
                status.playing = false;
                status.position_ms = 0;
                status.duration_ms = 0;
                drop(status);
                self.sink.stop();
                self.active = false;
                self.offset_ms = 0;
            }
            Some(current) if current > index => {
                status.current_index = Some(current - 1);
            }
            _ => {}
        }
    }

    /* ------------------------------------------------------ helpers ---- */

    fn len(&self) -> usize {
        lock(&self.playlist).len()
    }

    fn with_status<F: FnOnce(&mut PlayerStatus)>(&self, f: F) {
        f(&mut lock(&self.status));
    }

    fn read_status<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&PlayerStatus) -> R,
    {
        f(&lock(&self.status))
    }

    fn emit_error(&self, message: String) {
        log::error!("{message}");
        let _ = self.app.emit("player-error", message);
    }
}
