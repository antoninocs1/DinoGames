import { PATH_INVADER_IMAGE, getScale } from "../utils/constants.js";
import Projectile from "./Projectile.js";

class Invader {
    constructor(position, velocity) {
        this.position = position;
        this.scale = 0.8 * getScale();
        this.width = 50 * this.scale;
        this.height = 37 * this.scale;
        this.velocity = velocity;

        this.image = this.getImage(PATH_INVADER_IMAGE);
    }

    moveRight() {
        this.position.x += this.velocity;
    }

    moveLeft() {
        this.position.x -= this.velocity;
    }

    moveDown() {
        this.position.y += this.height;
    }

    incrementVelocity(boost) {
        this.velocity += boost;
    }

    getImage(path) {
        const image = new Image();
        image.src = path;
        return image;
    }

    draw(ctx) {
        ctx.drawImage(
            this.image,
            this.position.x,
            this.position.y,
            this.width,
            this.height
        );
    }

    shoot(projectiles) {
        const p = new Projectile(
            {
                x: this.position.x + this.width / 2 - 2,
                y: this.position.y + this.height,
            },
            10
        );
        projectiles.push(p);
    }

    hit(projectile) {
        return (
            projectile.position.x >= this.position.x &&
            projectile.position.x <= this.position.x + this.width &&
            projectile.position.y >= this.position.y &&
            projectile.position.y <= this.position.y + this.height
        );
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

export default Invader;
