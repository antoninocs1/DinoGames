class SoundEffects {
    constructor() {
        this.muted = false;
        this.shootSounds = [
            new Audio("src/assets/audios/shoot.mp3"),
            new Audio("src/assets/audios/shoot.mp3"),
            new Audio("src/assets/audios/shoot.mp3"),
            new Audio("src/assets/audios/shoot.mp3"),
            new Audio("src/assets/audios/shoot.mp3"),
        ];

        this.hitSounds = [
            new Audio("src/assets/audios/hit.mp3"),
            new Audio("src/assets/audios/hit.mp3"),
            new Audio("src/assets/audios/hit.mp3"),
            new Audio("src/assets/audios/hit.mp3"),
            new Audio("src/assets/audios/hit.mp3"),
        ];

        this.explosionSound = new Audio("src/assets/audios/explosion.mp3");
        this.nextLevelSound = new Audio("src/assets/audios/next_level.mp3");

        this.currentShootSound = 0;
        this.currentHitSound = 0;

        this.adjustVolumes();
    }

    isMuted() {
        return this.muted;
    }

    toggleMute() {
        this.muted = !this.muted;
        this.adjustVolumes();
    }

    playShootSound() {
        if (this.muted) return;

        this.shootSounds[this.currentShootSound].currentTime = 0;
        this.shootSounds[this.currentShootSound].play();
        this.currentShootSound =
            (this.currentShootSound + 1) % this.shootSounds.length;
    }

    playHitSound() {
        if (this.muted) return;

        this.hitSounds[this.currentHitSound].currentTime = 0;
        this.hitSounds[this.currentHitSound].play();
        this.currentHitSound = (this.currentHitSound + 1) % this.hitSounds.length;
    }

    playExplosionSound() {
        if (this.muted) return;
        this.explosionSound.play();
    }

    playNextLevelSound() {
        if (this.muted) return;
        this.nextLevelSound.play();
    }

    adjustVolumes() {
        const volume = this.muted ? 0 : 1;

        this.hitSounds.forEach((sound) => (sound.volume = 0.2 * volume));
        this.shootSounds.forEach((sound) => (sound.volume = 0.5 * volume));
        this.explosionSound.volume = 0.2 * volume;
        this.nextLevelSound.volume = 0.4 * volume;
    }
}

export default SoundEffects;
