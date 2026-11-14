import { PATH_INVADER_IMAGE, getScale } from "../utils/constants.js";
import Projectile from "./Projectile.js";

class Enemy {
    constructor(position, velocity, type = "scout") {
        this.position = position;
        this.velocity = velocity;
        this.type = type;
        const scale = getScale();
        this.width = (type === "tank" ? 58 : 46) * scale;
        this.height = (type === "tank" ? 42 : 30) * scale;
        this.color = type === "tank" ? "#ffb703" : type === "runner" ? "#00f5d4" : "#8ecae6";
        this.health = type === "tank" ? 2 : 1;
        this.points = type === "tank" ? 20 : type === "runner" ? 15 : 10;
        this.flashFrames = 0;
        this.image = new Image();
        this.image.src = PATH_INVADER_IMAGE;
    }

    // Retorna true quando o inimigo é destruído.
    takeDamage() {
        this.health -= 1;
        this.flashFrames = 6;
        return this.health <= 0;
    }

    incrementVelocity(boost) {
        this.velocity += boost;
    }

    moveRight() {
        this.position.x += this.velocity;
    }

    moveLeft() {
        this.position.x -= this.velocity;
    }

    moveDown() {
        this.position.y += this.height * 0.7;
    }

    shoot(projectiles) {
        projectiles.push(
            new Projectile(
                {
                x: this.position.x + this.width / 2 - 2,
                y: this.position.y + this.height,
                },
                this.type === "runner" ? 9 : 7,
                4,
                this.color,
                18
            )
        );
    }

    draw(ctx) {
        if (this.image.complete && this.image.naturalWidth > 0) {
            ctx.save();
            ctx.shadowColor = this.flashFrames > 0 ? "#ffffff" : this.color;
            ctx.shadowBlur = this.flashFrames > 0 ? 18 : this.type === "tank" ? 7 : 3;
            if (this.flashFrames > 0) this.flashFrames -= 1;
            // Tank danificado fica semitransparente.
            if (this.type === "tank" && this.health < 2) ctx.globalAlpha = 0.65;
            ctx.drawImage(
                this.image,
                this.position.x,
                this.position.y,
                this.width,
                this.height
            );
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        }
    }

    hit(projectile) {
        return projectile.position.x >= this.position.x &&
            projectile.position.x <= this.position.x + this.width &&
            projectile.position.y >= this.position.y &&
            projectile.position.y <= this.position.y + this.height;
    }

    collided(obstacle) {
        return this.position.x < obstacle.position.x + obstacle.width &&
            this.position.x + this.width > obstacle.position.x &&
            this.position.y < obstacle.position.y + obstacle.height &&
            this.position.y + this.height > obstacle.position.y;
    }

    collidedWithPlayer(player) {
        return this.position.x < player.position.x + player.width &&
            this.position.x + this.width > player.position.x &&
            this.position.y < player.position.y + player.height &&
            this.position.y + this.height > player.position.y;
    }
}

export default Enemy;
