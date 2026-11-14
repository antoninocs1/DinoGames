import { PATH_INVADER_IMAGE } from "../utils/constants.js";

class Boss {
    constructor(position, velocity) {
        this.position = position;
        this.velocity = velocity;
        this.width = 150;
        this.height = 90;
        this.maxHealth = 20;
        this.health = this.maxHealth;
        this.image = this.getImage(PATH_INVADER_IMAGE);
    }

    getImage(path) {
        const image = new Image();
        image.src = path;
        return image;
    }

    moveRight() {
        this.position.x += this.velocity;
    }

    moveLeft() {
        this.position.x -= this.velocity;
    }

    moveDown() {
        this.position.y += 12;
    }

    shoot(projectiles) {
        const spread = [-6, 0, 6];
        spread.forEach((angle) => {
            const projectile = {
                position: {
                    x: this.position.x + this.width / 2 - 2 + angle,
                    y: this.position.y + this.height,
                },
                width: 4,
                height: 18,
                velocity: 8,
            };
            projectiles.push(projectile);
        });
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(this.position.x - 15, this.position.y + this.height + 8, this.width + 30, 12);
        ctx.fillStyle = "#ff4d6d";
        ctx.fillRect(this.position.x, this.position.y + this.height + 12, this.width * (this.health / this.maxHealth), 8);
        ctx.restore();

        ctx.drawImage(
            this.image,
            this.position.x,
            this.position.y,
            this.width,
            this.height
        );
    }

    hit(projectile) {
        return projectile.position.x >= this.position.x &&
            projectile.position.x <= this.position.x + this.width &&
            projectile.position.y >= this.position.y &&
            projectile.position.y <= this.position.y + this.height;
    }
}

export default Boss;
