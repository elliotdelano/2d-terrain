const canvas = document.getElementById('canvas');

const app = new PIXI.Application({
    view: canvas,
    width: window.innerWidth,
    height: window.innerHeight
});

const { stage, view, ticker, renderer } = app;

document.body.appendChild(view);
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

noise.seed(Math.random());

const CHUNK_WIDTH = 16;
const CHUNK_HEIGHT = 64;
const TILE_SIZE = 16;

var chunks = [];

let player;

var motionX = 0;
var motionY = 0;
var player_acceleration = 0.1;
var player_friction = 0.03;
var player_max_speed = 5;
var player_max_speed_modified = player_max_speed;

let buffer = 0.05;

const shader = PIXI.Shader.from(`

    precision mediump float;
    attribute vec2 aVertexPosition;

    uniform mat3 translationMatrix;
    uniform mat3 projectionMatrix;

    void main() {
        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    }`,

    `precision mediump float;

    void main() {
        gl_FragColor = vec4(0.5, .2, .2, 1.0);
    }

`);

const coloredShader = PIXI.Shader.from(`

    precision mediump float;
    attribute vec2 aVertexPosition;
    attribute vec3 aColor;

    uniform mat3 translationMatrix;
    uniform mat3 projectionMatrix;

    varying vec3 vColor;

    void main() {

        vColor = aColor;
        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);

    }`,

    `precision mediump float;

    varying vec3 vColor;

    void main() {
        gl_FragColor = vec4(vColor, 1.0);
    }

`);

var buttonDown = false;
var drawMode = 0;

//stage.interactive = true;
console.log(stage);
window.addEventListener('mousedown', (e) => {
    buttonDown = true;
    unnamedFunction(e, 1);
    if (drawMode == 0 && buttonDown) {
        unnamedFunction(e, 1);
    } else if (drawMode == 1 && buttonDown) {
        unnamedFunction(e, 0);
    }

});

window.addEventListener('mouseup', (e) => {
    buttonDown = false;
});

window.addEventListener('mousemove', mouseDrag);

function mouseDrag(e) {
    if (buttonDown && drawMode === 0) {
        unnamedFunction(e, 1);
    } else if (buttonDown && drawMode === 1) {
        unnamedFunction(e, 0);
    }
}

window.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    if (drawMode == 0) {
        drawMode = 1;
    } else if (drawMode == 1) {
        drawMode = 0;
    }
    return false;
}, false);

class chunk {
    constructor(x, y) {
        this.chunkNumber = x;
        this.chunk = new PIXI.Container();
        this.chunk.position.x = CHUNK_WIDTH * TILE_SIZE * x;
        this.chunk.position.y = 0;

        this.points = [];
        this.geos = [];
        this.hitbox = [];

        this.debug = new PIXI.Graphics();

        for (var j = 0; j < CHUNK_HEIGHT; j++) {

            for (var i = 0; i < CHUNK_WIDTH; i++) {
                var xO = map((i + x * CHUNK_WIDTH), x, (CHUNK_WIDTH + x * CHUNK_WIDTH), x / 1000, (CHUNK_WIDTH + x * CHUNK_WIDTH) / 100);
                var n = Math.floor(map(noise.perlin2(xO, 0), -1, 1, 0, CHUNK_HEIGHT));
                if (j > n) {
                    this.points.push([i * TILE_SIZE, j * TILE_SIZE, 1]);
                } else {
                    this.points.push([i * TILE_SIZE, j * TILE_SIZE, 0]);
                }
            }
        }
    }

    show() {
        stage.addChild(this.chunk);
    }
    hide() {
        stage.removeChild(this.chunk);
    }

    generateGeometry() {
        this.chunk.removeChild(this.m);
        this.geos = [];
        this.hitbox = [];

        for (var i = 0; i < this.points.length; i++) {
            var posX = this.points[i][0];
            var posY = this.points[i][1];
            var a = [posX, posY - TILE_SIZE / 2];
            var b = [posX + TILE_SIZE / 2, posY - TILE_SIZE];
            var c = [posX + TILE_SIZE, posY - TILE_SIZE / 2];
            var d = [posX + TILE_SIZE / 2, posY];

            var p2 = this.getPoint(posX / TILE_SIZE, (posY / TILE_SIZE) - 1);
            var p3 = this.getPoint((posX / TILE_SIZE) + 1, (posY / TILE_SIZE) - 1);
            var p4 = this.getPoint((posX / TILE_SIZE) + 1, posY / TILE_SIZE);

            var mode = getTileState(this.points[i][2], p2[2], p3[2], p4[2]);

            var colorA;
            if (posY > 600) {
                colorA = [82, 52, 5];
            } else {
                colorA = [20, 133, 19];
            }

            switch (mode) {
                //1
                case 8:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, a[0], a[1], d[0], d[1]
                        ]);
                    this.geos.push(g);
                    //console.log(mode);
                    this.hitbox.push(a);
                    this.hitbox.push(d);
                    break;

                //2
                case 4:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            a[0], a[1], posX, posY - TILE_SIZE, b[0], b[1]
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(a);
                    this.hitbox.push(b);
                    //console.log(mode);
                    break;

                //3
                case 12:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, posX, posY - TILE_SIZE, b[0], b[1],
                            posX, posY, d[0], d[1], b[0], b[1]
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(b);
                    this.hitbox.push(d);
                    //console.log(mode);
                    break;

                //4
                case 2:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            b[0], b[1], posX + TILE_SIZE, posY - TILE_SIZE, c[0], c[1]
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(b);
                    this.hitbox.push(c);
                    //console.log(mode);
                    break;

                //5
                case 10:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, a[0], a[1], b[0], b[1],
                            posX, posY, b[0], b[1], posX + TILE_SIZE, posY - TILE_SIZE,
                            posX, posY, d[0], d[1], posX + TILE_SIZE, posY - TILE_SIZE,
                            d[0], d[1], c[0], c[1], posX + TILE_SIZE, posY - TILE_SIZE
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(a);
                    this.hitbox.push(b);
                    this.hitbox.push(c);
                    this.hitbox.push(d);
                    //console.log(mode);
                    break;

                //6
                case 6:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            a[0], a[1], posX, posY - TILE_SIZE, posX + TILE_SIZE, posY - TILE_SIZE,
                            a[0], a[1], c[0], c[1], posX + TILE_SIZE, posY - TILE_SIZE
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(a);
                    this.hitbox.push(c);
                    //console.log(mode);
                    break;

                //7
                case 14:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, posX, posY - TILE_SIZE, d[0], d[1],
                            c[0], c[1], posX, posY - TILE_SIZE, d[0], d[1],
                            posX, posY - TILE_SIZE, posX + TILE_SIZE, posY - TILE_SIZE, c[0], c[1]
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(c);
                    this.hitbox.push(d);
                    //console.log(mode);
                    break;

                //8
                case 1:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            d[0], d[1], c[0], c[1], posX + TILE_SIZE, posY
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(c);
                    this.hitbox.push(d);
                    //console.log(mode);
                    break;

                //9
                case 9:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, a[0], a[1], posX + TILE_SIZE, posY,
                            c[0], c[1], a[0], a[1], posX + TILE_SIZE, posY
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(a);
                    this.hitbox.push(c);
                    //console.log(mode);
                    break;

                //10
                case 5:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            a[0], a[1], d[0], d[1], posX + TILE_SIZE, posY,
                            a[0], a[1], posX, posY - TILE_SIZE, posX + TILE_SIZE, posY,
                            posX, posY - TILE_SIZE, posX + TILE_SIZE, posY, c[0], c[1],
                            posX, posY - TILE_SIZE, b[0], b[1], c[0], c[1]
                        ]);
                    this.geos.push(g);

                    this.hitbox.push(b);
                    this.hitbox.push(c);
                    this.hitbox.push(a);
                    this.hitbox.push(d);
                    //console.log(mode);
                    break;
                //11
                case 13:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, posX, posY - TILE_SIZE, b[0], b[1],
                            c[0], c[1], posX, posY, b[0], b[1],
                            posX, posY, posX + TILE_SIZE, posY, c[0], c[1]
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(b);
                    this.hitbox.push(c);
                    //console.log(mode);
                    break;

                //12
                case 3:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            d[0], d[1], b[0], b[1], posX + TILE_SIZE, posY - TILE_SIZE,
                            d[0], d[1], posX + TILE_SIZE, posY, posX + TILE_SIZE, posY - TILE_SIZE
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(b);
                    this.hitbox.push(d);
                    //console.log(mode);
                    break;

                //13
                case 11:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, a[0], a[1], posX + TILE_SIZE, posY,
                            a[0], a[1], b[0], b[1], posX + TILE_SIZE, posY,
                            b[0], b[1], posX + TILE_SIZE, posY - TILE_SIZE, posX + TILE_SIZE, posY
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(a);
                    this.hitbox.push(b);
                    //console.log(mode);
                    break;

                //14
                case 7:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            a[0], a[1], posX, posY - TILE_SIZE, posX + TILE_SIZE, posY - TILE_SIZE,
                            a[0], a[1], d[0], d[1], posX + TILE_SIZE, posY - TILE_SIZE,
                            posX + TILE_SIZE, posY, d[0], d[1], posX + TILE_SIZE, posY - TILE_SIZE
                        ]);
                    this.geos.push(g);
                    this.hitbox.push(a);
                    this.hitbox.push(d);
                    //console.log(mode);
                    break;

                case 15:
                    var g = new PIXI.Geometry()
                        .addAttribute('aVertexPosition', [
                            posX, posY, posX, posY - TILE_SIZE, posX + TILE_SIZE, posY - TILE_SIZE, posX + TILE_SIZE, posY, posX, posY, posX + TILE_SIZE, posY - TILE_SIZE
                        ]);
                    this.geos.push(g);
                    //console.log(mode);
                    break;

            } // end of switch
        } // end of for loop
        this.Geometry = PIXI.Geometry.merge(this.geos);
        this.m = new PIXI.Mesh(this.Geometry, shader);
        this.chunk.addChild(this.m);


        //collider debug
        //this.debug.clear();
        //this.debug.lineStyle(1, 0xffffff);
        //
        //for (var i = 0; i < this.hitbox.length; i += 2) {
        //    this.debug.moveTo(this.hitbox[i][0], this.hitbox[i][1]);
        //    if (i < this.hitbox.length - 1) {
        //        this.debug.lineTo(this.hitbox[i + 1][0], this.hitbox[i + 1][1]);
        //    }
        //}
        //this.chunk.addChild(this.debug);
        //end collider debug
    }

    getPoint(x, y) {
        if (x >= CHUNK_WIDTH) {
            var c = getChunkID(this.chunkNumber + 1);
            if (c) {
                return c.getPoint(0, y);
            }
        }

        var p = this.points[chunkIndex(x, y)];
        if (p) {
            //console.log(p);
            return p;
        } //else
        return [0, 0, 0];
    }

    place(xi, yi, radius, PB) {
        var x = map(xi, this.chunk.position.x, this.chunk.position.x + CHUNK_WIDTH * TILE_SIZE, 0, CHUNK_WIDTH * TILE_SIZE);
        var y = map(yi, this.chunk.position.y, this.chunk.position.y + CHUNK_HEIGHT * TILE_SIZE, 0, CHUNK_HEIGHT * TILE_SIZE);
        for (var i = 0; i < this.points.length; i++) {
            if (pointCircleCheck(x, y, this.points[i][0], this.points[i][1], radius)) {
                this.points[i][2] = PB;
                if (this.points[i][0] <= 0) {
                    var c = getChunkID(this.chunkNumber - 1);
                    if (c) {
                        c.generateGeometry();
                    }
                }
            }
        }
        this.generateGeometry();
    }
}

class user {
    x;
    y;
    circle = new PIXI.Graphics();
    current;
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.r = radius;
        this.circle.beginFill(0x00ff00);
        this.circle.drawCircle(0, 0, this.r);
        this.circle.endFill();
        stage.addChild(this.circle);
        this.current = getChunk(this.x, this.y);
    }

    hit() {
        this.circle.clear();
        this.circle.beginFill(0xff0000);
        this.circle.drawCircle(0, 0, this.r);
        this.circle.endFill();
    }
    nothing() {
        this.circle.clear();
        this.circle.beginFill(0x00ff00);
        this.circle.drawCircle(0, 0, this.r);
        this.circle.endFill();
    }

    move() {
        if (!(this.current.chunk.position.x <= this.x && this.x <= this.current.chunk.position.x + (TILE_SIZE * CHUNK_WIDTH) && this.current.chunk.position.y <= this.y && this.y <= this.current.chunk.position.y + (TILE_SIZE * CHUNK_HEIGHT))) {
            this.current = getChunk(this.x, this.y);
            handleChunks(this.current);
        }

        movePlayer();
        this.circle.position.set(this.x, this.y);
    }


}

function setup() {
    //new chunk(0, 0);
    //for (let i = 0; i < 8; i++) {
    //    chunks.push(new chunk(i, 0));
    //}
    //for (let i = 0; i < chunks.length; i++) {
    //    chunks[i].generateGeometry();
    //}
    chunks.push(new chunk(0, 0));

    document.addEventListener('keydown', e => {
        keyDown(e);
    });
    document.addEventListener('keyup', e => {
        keyUp(e);
    });
    document.addEventListener('wheel', e => {
        //Render.zoom(e.deltaY * -0.0001);
    });
    player = new user(0, 50, 10);
    handleChunks(chunks[0]);
    stage.position.set(renderer.width / 2, 0);
    update();
}

var upPressed = false;
var downPressed = false;
var leftPressed = false;
var rightPressed = false;

function keyUp(e) {
    if (e.repeat) { return }
    var keyReleased = e.key;
    switch (keyReleased) {
        case 'w': upPressed = false; break;
        case 'a': leftPressed = false; break;
        case 's': downPressed = false; break;
        case 'd': rightPressed = false; break;
        default: console.log("no relevant key released");
    }
}

function keyDown(e) {
    if (e.repeat) {
        return;
    }
    var keyPressed = e.key;
    switch (keyPressed) {
        case 'w': upPressed = true; break;
        case 'a': leftPressed = true; break;
        case 's': downPressed = true; break;
        case 'd': rightPressed = true; break;
        default: console.log("no relevant key pressed");
    }
}

function movePlayer() {

    if (upPressed == true) {
        if (rightPressed == true) {
            player_max_speed_modified = player_max_speed * (Math.sqrt(2) / 2);
        } else if (leftPressed != true) {
            player_max_speed_modified = player_max_speed;
        }
        if (leftPressed == true) {
            player_max_speed_modified = player_max_speed * (Math.sqrt(2) / 2);
        } else if (rightPressed != true) {
            player_max_speed_modified = player_max_speed;
        }
    }

    if (downPressed == true) {
        if (rightPressed == true) {
            player_max_speed_modified = player_max_speed * (Math.sqrt(2) / 2);
        } else if (leftPressed != true) {
            player_max_speed_modified = player_max_speed;
        }
        if (leftPressed == true) {
            player_max_speed_modified = player_max_speed * (Math.sqrt(2) / 2);
        } else if (rightPressed != true) {
            player_max_speed_modified = player_max_speed;
        }
    }

    if (rightPressed == true) {
        motionX = Math.min(motionX += player_acceleration, player_max_speed_modified);
    } else if (leftPressed == true) {
        motionX = Math.max(motionX -= player_acceleration, -player_max_speed_modified);
    } else {
        motionX = lerp(motionX, 0, player_friction);
    }

    if (downPressed == true) {
        motionY = Math.min(motionY += player_acceleration, player_max_speed_modified);
    } else if (upPressed == true) {
        motionY = Math.max(motionY -= player_acceleration, -player_max_speed_modified);
    } else {
        motionY = lerp(motionY, 0, player_friction);
    }


    for (var i = 0; i < player.current.hitbox.length; i += 2) {
        if (i < player.current.hitbox.length - 1) {
            if (lineCircleCheck(player.current.hitbox[i][0], player.current.hitbox[i][1], player.current.hitbox[i + 1][0], player.current.hitbox[i + 1][1],
                map(player.x + motionX, player.current.chunk.position.x, player.current.chunk.position.x + CHUNK_WIDTH * TILE_SIZE, 0, CHUNK_WIDTH * TILE_SIZE),
                map(player.y + motionY, player.current.chunk.position.y, player.current.chunk.position.y + CHUNK_HEIGHT * TILE_SIZE, 0, CHUNK_HEIGHT * TILE_SIZE), player.r)) {

                let lx = player.current.hitbox[i][0];
                let lx2 = player.current.hitbox[i + 1][0];
                let ly = player.current.hitbox[i][1];
                let ly2 = player.current.hitbox[i + 1][1];

                let slope;
                if (lx == lx2) {
                    slope = 2;
                } else if (ly == ly2) {
                    slope = 0;
                } else {
                    //slope = ((ly2 - player.current.chunk.position.y) - (ly - player.current.chunk.position.y)) / ((lx2 - player.current.chunk.position.x) - (lx - player.current.chunk.position.x));
                    slope = ((ly2) - (ly)) / ((lx2) - (lx));
                }
                console.log(slope);

                switch (slope) {
                    case 0:
                        player.x += motionX;
                        break;
                    case 1:
                        if (motionX < 0) {
                            player.x += motionX / 2;
                            player.y += motionX / 2;
                        } else if (motionX > 0) {
                            player.x += motionX;
                        }
                        break;
                    case -1:
                        if (motionX > 0) {
                            player.x += motionX / 2;
                            player.y -= motionX / 2;
                        } else if (motionX < 0) {
                            player.x += motionX;
                        }
                        break;
                    case 2:
                        player.y += motionY;
                        break;
                }

                //if (lineCircleCheckY(player.current.hitbox[i][1], player.current.hitbox[i + 1][1], map(player.y + motionY, player.current.chunk.position.y, player.current.chunk.position.y + CHUNK_HEIGHT * TILE_SIZE, 0, CHUNK_HEIGHT * TILE_SIZE), player.r)) {
                //    //player.y -= motionY;
                //} else {
                //    player.y += motionY;
                //}
                //
                //if (lineCircleCheckX(player.current.hitbox[i][0], player.current.hitbox[i + 1][0], map(player.x + motionX, player.current.chunk.position.x, player.current.chunk.position.x + CHUNK_WIDTH * TILE_SIZE, 0, CHUNK_WIDTH * TILE_SIZE), player.r)) {
                //    //player.x -= motionX;
                //} else {
                //    player.x += motionX;
                //}

                return;
            }
        }
    }

    player.x += motionX;
    player.y += motionY;
}

function update() {
    //if (isGrounded() && motionY > 0) {
    //    motionY = 0;
    //}
    player.move();
    stage.pivot.x = player.x;


    requestAnimationFrame(update);
}

function handleChunks(current) {
    let surround = [current.chunkNumber - 4,
    current.chunkNumber - 3, current.chunkNumber - 2,
    current.chunkNumber - 1, current.chunkNumber,
    current.chunkNumber + 1, current.chunkNumber + 2,
    current.chunkNumber + 3, current.chunkNumber + 4];

    for (var i = 0; i < surround.length; i++) {
        if (!chunkFromNum(surround[i])) {
            chunks.push(new chunk(surround[i], 0));
        }
    }

    for (var i = 0; i < chunks.length; i++) {
        let found = false;
        if (surround.includes(chunks[i].chunkNumber)) {
            found = true;
            chunks[i].show();
            chunks[i].generateGeometry();
        } else {
            chunks[i].hide();
        }
    }
}


function unnamedFunction(e, m) {
    var x = e.offsetX + player.x - renderer.width / 2;
    var y = e.offsetY;
    var radius = 48;

    for (var i = 0; i < chunks.length; i++) {
        var c1;
        var c2;
        if (chunks[i].chunk.position.x <= x - radius && x - radius <= chunks[i].chunk.position.x + (TILE_SIZE * CHUNK_WIDTH) && chunks[i].chunk.position.y <= y && y <= chunks[i].chunk.position.y + (TILE_SIZE * CHUNK_HEIGHT)) {
            c1 = chunks[i];
        }
        if (chunks[i].chunk.position.x <= x + radius && x + radius <= chunks[i].chunk.position.x + (TILE_SIZE * CHUNK_WIDTH) && chunks[i].chunk.position.y <= y && y <= chunks[i].chunk.position.y + (TILE_SIZE * CHUNK_HEIGHT)) {
            c2 = chunks[i];
        }
        if (c1) {
            if (c2) {
                if (c1 != c2) {
                    c1.place(x, y, radius, m);
                    c2.place(x, y, radius, m);
                    return;
                }
            }
            c1.place(x, y, radius, m);
        }

    }
}

function getChunk(x, y) {
    for (var i = 0; i < chunks.length; i++) {
        if (chunks[i].chunk.position.x <= x && x <= chunks[i].chunk.position.x + (TILE_SIZE * CHUNK_WIDTH) && chunks[i].chunk.position.y <= y && y <= chunks[i].chunk.position.y + (TILE_SIZE * CHUNK_HEIGHT)) {
            return chunks[i];
        }
    }
}

function getChunkID(x) {
    for (var i = 0; i < chunks.length; i++) {
        if (chunks[i].chunkNumber == x) {
            return chunks[i];
        }
    }
    return false;
}

function chunkFromNum(x) {
    for (var i = 0; i < chunks.length; i++) {
        if (chunks[i].chunkNumber == x) {
            return true;
        }
    }
    return false;
}

function isGrounded() {
    for (var i = 0; i < player.current.hitbox.length; i += 2) {
        if (i < player.current.hitbox.length - 1) {

            return lineCircleCheck(player.current.hitbox[i][0], player.current.hitbox[i][1], player.current.hitbox[i + 1][0], player.current.hitbox[i + 1][1],
                map(player.x, player.current.chunk.position.x, player.current.chunk.position.x + CHUNK_WIDTH * TILE_SIZE, 0, CHUNK_WIDTH * TILE_SIZE),
                map(player.y + player.r, player.current.chunk.position.y, player.current.chunk.position.y + CHUNK_HEIGHT * TILE_SIZE, 0, CHUNK_HEIGHT * TILE_SIZE), player.r);
        }
    }
}

function getTileState(a, b, c, d) {
    return a * 8 + b * 4 + c * 2 + d * 1;
}

function chunkIndex(x, y) {
    return x + y * CHUNK_WIDTH;
}

function map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function distance(x1, y1, x2, y2) {
    return Math.hypot((x1 - x2), (y1 - y2));
}

setup();


//collision detection functions

function lineCircleCheck(x1, y1, x2, y2, cx, cy, r) {
    let inside1 = pointCircleCheck(x1, y1, cx, cy, r);
    let inside2 = pointCircleCheck(x2, y2, cx, cy, r);
    if (inside1 || inside2) return true;

    let distX = x1 - x2;
    let distY = y1 - y2;
    let len = Math.sqrt(distX * distX + distY * distY);

    let dot = (((cx - x1) * (x2 - x1)) + ((cy - y1) * (y2 - y1))) / Math.pow(len, 2);
    let closestX = x1 + (dot * (x2 - x1));
    let closestY = y1 + (dot * (y2 - y1));

    let onSegment = linePointCheck(x1, y1, x2, y2, closestX, closestY);
    if (!onSegment) return false;

    distX = closestX - cx;
    distY = closestY - cy;
    let dist = Math.sqrt((distX * distX) + (distY * distY));

    if (dist <= r) {
        return true;
    }
    return false;
}

function pointCircleCheck(a, b, x, y, r) {
    var dist_points = (a - x) * (a - x) + (b - y) * (b - y);
    r *= r;
    if (dist_points < r) {
        return true;
    }
    return false;
}


function linePointCheck(x1, y1, x2, y2, px, py) {
    let d1 = distance(px, py, x1, y1);
    let d2 = distance(px, py, x2, y2);

    let lineLen = distance(x1, y1, x2, y2);

    if (d1 + d2 >= lineLen - buffer && d1 + d2 <= lineLen + buffer) return true;

    return false;
}

function lineCircleCheckX(lx, lx2, cx, cr) {
    //if (lineCircleCheck(lx, 0, lx2, 0, cx, 0, cr)) {
    //    return true;
    //}
    //return false;
    if (lx == lx2) {
        return true;
    }
    return false;
}

function lineCircleCheckY(ly, ly2, cy, cr) {
    //if (lineCircleCheck(0, ly, 0, ly2, 0, cy, cr)) {
    //    return true;
    //}
    //return false;
    if (ly == ly2) {
        return true;
    }
    return false;
}