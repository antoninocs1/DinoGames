import Enemy from "./Enemy.js";
import Invader from "./Invader.js";
import { getScale, isSmallScreen } from "../utils/constants.js";

class Grid {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.direction = "right";
        this.moveDown = false;
        this.boost = 0.1;
        this.invadersVelocity = 1;

        this.invaders = this.init();
    }

    init() {
        const array = [];
        const scale = getScale();
        const pitch = 62 * scale;
        // Em telas estreitas limita as colunas para a formação caber com folga.
        const maxCols = Math.max(3, Math.floor((innerWidth * 0.8) / pitch));
        const cols = Math.min(this.cols, maxCols);
        const startX = Math.max(10, innerWidth / 2 - (cols * pitch) / 2);
        const startY = isSmallScreen() ? 150 : 120;

        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                const type = row === 0
                    ? "runner"
                    : row === this.rows - 1
                        ? "tank"
                        : "scout";
                const EnemyType = type === "tank" || type === "runner" ? Enemy : Invader;
                const invader = new EnemyType(
                    {
                        x: startX + col * pitch,
                        y: startY + row * 46 * scale,
                    },
                    this.invadersVelocity,
                    type
                );

                array.push(invader);
            }
        }

        return array;
    }

    draw(ctx) {
        this.invaders.forEach((invader) => invader.draw(ctx));
    }

    update(playerStatus) {
        if (this.reachedRightBoundary()) {
            this.direction = "left";
            this.moveDown = true;
        } else if (this.reachedLeftBoundary()) {
            this.direction = "right";
            this.moveDown = true;
        }

        if (!playerStatus) this.moveDown = false;

        this.invaders.forEach((invader) => {
            if (this.moveDown) {
                invader.moveDown();
                if (typeof invader.incrementVelocity === "function") {
                    invader.incrementVelocity(this.boost);
                    this.invadersVelocity = invader.velocity;
                }
            }

            if (this.direction === "right") invader.moveRight();
            if (this.direction === "left") invader.moveLeft();
        });

        this.moveDown = false;
    }

    reachedRightBoundary() {
        return this.invaders.some(
            (invader) => invader.position.x + invader.width >= innerWidth
        );
    }

    reachedLeftBoundary() {
        return this.invaders.some((invader) => invader.position.x <= 0);
    }

    getRandomInvader() {
        const index = Math.floor(Math.random() * this.invaders.length);
        return this.invaders[index];
    }

    restart() {
        this.invaders = this.init();
        this.direction = "right";
        this.moveDown = false;
    }
}

export default Grid;
