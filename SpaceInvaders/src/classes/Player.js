import {
    INITIAL_FRAMES,
    PATH_ENGINE_IMAGE,
    PATH_ENGINE_SPRITES,
    PATH_SPACESHIP_IMAGE,
    getScale,
} from "../utils/constants.js";

import Projectile from "./Projectile.js";

class Player {
    constructor(canvasWidth, canvasHeight) {
        this.alive = true;
        this.updateSize();
        this.velocity = 6;
        this.fireCooldown = 0;
        this.shield = 0;

        this.position = {
            x: canvasWidth / 2 - this.width / 2,
            y: canvasHeight - this.height - 30,
        };

        this.image = this.getImage(PATH_SPACESHIP_IMAGE);
        this.engineImage = this.getImage(PATH_ENGINE_IMAGE);
        this.engineSprites = this.getImage(PATH_ENGINE_SPRITES);

        this.sx = 0;
        this.framesCounter = INITIAL_FRAMES;
    }

    // Ajusta o tamanho da nave à largura da tela.
    updateSize() {
        this.width = 96 * getScale();
        this.height = this.width;
    }

    moveLeft() {
        this.position.x -= this.velocity;
    }

    moveRight() {
        this.position.x += this.velocity;
    }

    getImage(path) {
        const image = new Image();
        image.src = path;
        return image;
    }

    draw(ctx, tilt = 0) {
        const centerX = this.position.x + this.width / 2;
        const centerY = this.position.y + this.height / 2;
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(tilt);

        if (this.shield > 0) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(77, 155, 230, 0.9)";
            ctx.lineWidth = 2;
            ctx.arc(0, 0, this.width * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.image.complete && this.image.naturalWidth > 0) {
            ctx.drawImage(
                this.image,
                -halfWidth,
                -halfHeight,
                this.width,
                this.height
            );

            if (this.engineSprites.complete && this.engineSprites.naturalWidth > 0) {
                ctx.drawImage(
                    this.engineSprites,
                    this.sx,
                    0,
                    48,
                    48,
                    -halfWidth,
                    -halfHeight + 10,
                    this.width,
                    this.height
                );
            }

            if (this.engineImage.complete && this.engineImage.naturalWidth > 0) {
                ctx.drawImage(
                    this.engineImage,
                    -halfWidth,
                    -halfHeight + 8,
                    this.width,
                    this.height
                );
            }
        } else {
            this.drawFallback(ctx, halfWidth, halfHeight);
        }

        ctx.restore();
        this.update();
    }

    drawFallback(ctx, halfWidth, halfHeight) {
        const top = -halfHeight + 8;
        const bottom = halfHeight - 4;
        ctx.save();
        ctx.shadowColor = "#4d9be6";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#dceeff";
        ctx.beginPath();
        ctx.moveTo(0, top);
        ctx.lineTo(halfWidth - 5, bottom);
        ctx.lineTo(0, bottom - 15);
        ctx.lineTo(-halfWidth + 5, bottom);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#4d9be6";
        ctx.fillRect(-5, -halfHeight + 26, 10, 18);
        ctx.restore();
    }

    update() {
        if (this.fireCooldown > 0) {
            this.fireCooldown = Math.max(0, this.fireCooldown - 1 / 60);
        }

        if (this.shield > 0) {
            this.shield = Math.max(0, this.shield - 1 / 60);
        }

        if (this.framesCounter === 0) {
            this.sx = this.sx === 96 ? 0 : this.sx + 48;
            this.framesCounter = INITIAL_FRAMES;
        }

        this.framesCounter--;
    }

    setShield(seconds) {
        this.shield = Math.max(this.shield, seconds);
    }

    shoot(projectiles) {
        if (this.fireCooldown > 0) return false;

        const p = new Projectile(
            {
                x: this.position.x + this.width / 2 - 2,
                y: this.position.y + 2,
            },
            -10
        );

        projectiles.push(p);
        this.fireCooldown = 0.18;
        return true;
    }

    hit(projectile) {
        return (
            projectile.position.x >= this.position.x + this.width * 0.21 &&
            projectile.position.x <= this.position.x + this.width * 0.81 &&
            projectile.position.y + projectile.height >= this.position.y + this.height * 0.23 &&
            projectile.position.y + projectile.height <= this.position.y + this.height * 0.88
        );
    }
}

export default Player;
