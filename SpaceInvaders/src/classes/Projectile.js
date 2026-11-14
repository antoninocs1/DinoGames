class Projectile {
    constructor(position, velocity, width = 2, color = "white", height = 20) {
        this.position = position;
        this.width = width;
        this.height = height;
        this.velocity = velocity;
        this.color = color;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
    }

    update() {
        this.position.y += this.velocity;
    }
}

export default Projectile;
