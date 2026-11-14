class AudioEngine {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.enabled = true;
        this.musicIntervalId = null;
        this.musicNoteIndex = 0;
        this.musicRequested = false;
    }

    ensureContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;

            this.ctx = new AudioCtx();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.12;
            this.master.connect(this.ctx.destination);
        }

        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }

        return this.ctx;
    }

    toggleMute() {
        this.enabled = !this.enabled;
        if (this.master) {
            this.master.gain.value = this.enabled ? 0.12 : 0;
        }

        if (this.enabled && this.musicRequested && this.musicIntervalId === null) {
            this.startMusic();
        }
    }

    startMusic() {
        this.musicRequested = true;
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || this.musicIntervalId !== null) return;

        const melody = [220, 261.63, 329.63, 261.63, 196, 246.94, 293.66, 246.94];
        const playNextNote = () => {
            if (!this.enabled || !this.ctx) return;

            const oscillator = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;
            const noteDuration = 0.34;

            oscillator.type = "triangle";
            oscillator.frequency.value = melody[this.musicNoteIndex];
            this.musicNoteIndex = (this.musicNoteIndex + 1) % melody.length;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.018, now + 0.035);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration);

            oscillator.connect(gain);
            gain.connect(this.master);
            oscillator.start(now);
            oscillator.stop(now + noteDuration);
        };

        this.musicIntervalId = window.setInterval(playNextNote, 420);
        playNextNote();
    }

    stopMusic() {
        this.musicRequested = false;
        if (this.musicIntervalId !== null) {
            window.clearInterval(this.musicIntervalId);
            this.musicIntervalId = null;
        }
    }

    pulse(freq = 220, duration = 0.08, volume = 0.04) {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.value = volume;

        osc.connect(gain);
        gain.connect(this.master);

        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.stop(ctx.currentTime + duration);
    }

    shoot() {
        this.pulse(520, 0.07, 0.035);
    }

    hit() {
        this.pulse(180, 0.12, 0.05);
    }

    explosion() {
        this.pulse(90, 0.22, 0.08);
    }

    nextLevel() {
        this.pulse(660, 0.18, 0.06);
    }
}

export default AudioEngine;
