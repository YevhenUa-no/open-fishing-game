import Phaser from "phaser";
import { net } from "./net.js";

const RARITY_COLORS = {
  common: "#cccccc",
  uncommon: "#4ecdc4",
  rare: "#ffe66d",
  legendary: "#ff6b6b",
};

export class OceanScene extends Phaser.Scene {
  constructor() {
    super("OceanScene");
    this.otherSprites = new Map(); // id -> { container, label }
    this.worldSize = 1000;
    this.selfId = null;
    this.targetPos = null;
    this.fishing = false;
    this.minigame = null;
  }

  preload() {
    // All visuals are drawn procedurally (no external art assets needed),
    // so the game works instantly from a single bundled file.
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a3d62");
    this.drawWaterBackground();

    // Self player
    this.selfContainer = this.add.container(500, 500);
    this.selfBoat = this.makeBoat("#ffe66d");
    this.selfContainer.add(this.selfBoat);
    this.selfLabelBg = this.add.rectangle(0, -34, 10, 16, 0x000000, 0.4).setOrigin(0.5);
    this.selfLabel = this.add.text(0, -34, "You", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.selfContainer.add([this.selfLabelBg, this.selfLabel]);

    this.cameras.main.startFollow(this.selfContainer, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    // Movement input (drag-to-move, works with touch + mouse)
    this.input.on("pointerdown", (pointer) => this.handlePointer(pointer));
    this.input.on("pointermove", (pointer) => {
      if (pointer.isDown) this.handlePointer(pointer);
    });

    // UI: fish button
    this.createFishButton();
    this.createHUD();

    // Networking hooks
    this.setupNetworking();
  }

  drawWaterBackground() {
    const g = this.add.graphics();
    const tile = 50;
    for (let x = 0; x < this.worldSize + tile; x += tile) {
      for (let y = 0; y < this.worldSize + tile; y += tile) {
        const shade = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0 ? 0x0e4a73 : 0x0a3d62;
        g.fillStyle(shade, 1);
        g.fillRect(x, y, tile, tile);
      }
    }
    // World border
    g.lineStyle(6, 0x06283d, 1);
    g.strokeRect(0, 0, this.worldSize, this.worldSize);
  }

  makeBoat(color) {
    const c = this.add.container(0, 0);
    const hull = this.add.triangle(0, 0, -14, 10, 14, 10, 0, -14, Phaser.Display.Color.HexStringToColor(color).color);
    hull.setStrokeStyle(2, 0x06283d);
    const wake = this.add.ellipse(0, 12, 22, 8, 0xffffff, 0.25);
    c.add([wake, hull]);
    return c;
  }

  handlePointer(pointer) {
    if (this.fishing) return; // don't move while reeling
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.targetPos = {
      x: Phaser.Math.Clamp(world.x, 0, this.worldSize),
      y: Phaser.Math.Clamp(world.y, 0, this.worldSize),
    };
  }

  createFishButton() {
    this.fishBtn = this.add.text(0, 0, "🎣 Cast Line", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      backgroundColor: "#ffe66d",
      color: "#06283d",
      padding: { x: 16, y: 10 },
    })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(100);

    this.fishBtn.on("pointerdown", () => this.onFishButton());
    this.layoutHUD();
    this.scale.on("resize", () => this.layoutHUD());
  }

  createHUD() {
    this.chatLog = this.add.text(10, 10, "Welcome to the waters! 🌊", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 8, y: 6 },
      wordWrap: { width: 260 },
    }).setScrollFactor(0).setAlpha(0.85).setDepth(100);
    this.chatMessages = [];

    this.resultText = this.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      color: "#ffffff",
      backgroundColor: "#000000cc",
      padding: { x: 14, y: 10 },
      align: "center",
    }).setScrollFactor(0).setOrigin(0.5).setDepth(200).setVisible(false);
  }

  layoutHUD() {
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.fishBtn) this.fishBtn.setPosition(w / 2 - this.fishBtn.width / 2, h - this.fishBtn.height - 24);
    if (this.resultText) this.resultText.setPosition(w / 2, h / 2);
  }

  logChat(text) {
    this.chatMessages.push(text);
    if (this.chatMessages.length > 5) this.chatMessages.shift();
    this.chatLog.setText(this.chatMessages.join("\n"));
  }

  onFishButton() {
    if (this.fishing) return;
    this.fishing = true;
    this.fishBtn.setText("Casting…");
    net.castLine();
    this.startMinigame();
  }

  // Simple timing-bar minigame: a marker sweeps left-right across a bar,
  // player taps when it's inside the green "sweet spot". Accuracy sent to server.
  startMinigame() {
    const w = this.scale.width;
    const h = this.scale.height;
    const barWidth = Math.min(280, w - 60);
    const barY = h - 120;

    const group = this.add.container(w / 2, barY).setScrollFactor(0).setDepth(200);
    const bg = this.add.rectangle(0, 0, barWidth, 24, 0x222222).setStrokeStyle(2, 0xffffff);
    const sweetSpotWidth = Phaser.Math.Between(30, 55);
    const sweetSpotX = Phaser.Math.Between(-barWidth / 2 + sweetSpotWidth, barWidth / 2 - sweetSpotWidth);
    const sweetSpot = this.add.rectangle(sweetSpotX, 0, sweetSpotWidth, 24, 0x1a936f, 0.9);
    const marker = this.add.rectangle(-barWidth / 2, 0, 6, 32, 0xffe66d);
    const label = this.add.text(0, -28, "Tap when the marker is in the green zone!", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#ffffff",
    }).setOrigin(0.5);

    group.add([bg, sweetSpot, marker, label]);

    let dir = 1;
    const speed = 260; // px/sec
    const update = (_, delta) => {
      marker.x += dir * speed * (delta / 1000);
      if (marker.x > barWidth / 2) dir = -1;
      if (marker.x < -barWidth / 2) dir = 1;
    };
    this.events.on("update", update);

    const finish = (accuracy) => {
      this.events.off("update", update);
      group.destroy();
      net.reel(accuracy);
    };

    const tapHandler = () => {
      const dist = Math.abs(marker.x - sweetSpotX);
      const maxDist = barWidth / 2;
      const accuracy = Phaser.Math.Clamp(1 - dist / (sweetSpotWidth * 1.5), 0, 1);
      this.input.off("pointerdown", tapHandler);
      finish(accuracy);
    };
    this.input.on("pointerdown", tapHandler);

    // Auto-fail if they wait too long
    this.time.delayedCall(6000, () => {
      this.input.off("pointerdown", tapHandler);
      if (group.active) finish(0);
    });
  }

  showResult(result) {
    this.fishing = false;
    this.fishBtn.setText("🎣 Cast Line");

    if (!result.success) {
      this.resultText.setText("The fish got away…").setVisible(true);
    } else {
      const c = result.catch;
      const color = RARITY_COLORS[c.rarity] || "#ffffff";
      this.resultText.setText(`Caught a ${c.name}!\n${c.size}cm (${c.rarity})`)
        .setColor(color)
        .setVisible(true);
    }
    this.time.delayedCall(1800, () => this.resultText.setVisible(false));
  }

  ensureOtherSprite(p) {
    if (this.otherSprites.has(p.id)) return this.otherSprites.get(p.id);
    const container = this.add.container(p.x, p.y);
    const boat = this.makeBoat(p.color || "#4ecdc4");
    const labelBg = this.add.rectangle(0, -34, 10, 16, 0x000000, 0.4).setOrigin(0.5);
    const label = this.add.text(0, -34, p.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: "#ffffff",
    }).setOrigin(0.5);
    container.add([boat, labelBg, label]);
    const entry = { container, boat, label };
    this.otherSprites.set(p.id, entry);
    return entry;
  }

  setupNetworking() {
    const socket = net.connect();

    socket.on("world:init", (data) => {
      this.selfId = data.selfId;
      this.worldSize = data.worldSize;
      const selfP = data.players.find((p) => p.id === data.selfId);
      if (selfP) {
        this.selfContainer.setPosition(selfP.x, selfP.y);
        this.targetPos = { x: selfP.x, y: selfP.y };
      }
      data.players.forEach((p) => {
        if (p.id === data.selfId) return;
        this.ensureOtherSprite(p);
      });
      this.logChat(`Connected. ${data.players.length} angler(s) online.`);
    });

    socket.on("players:update", (list) => {
      const ids = new Set(list.map((p) => p.id));
      // remove stale
      for (const [id, entry] of this.otherSprites) {
        if (!ids.has(id) && id !== this.selfId) {
          entry.container.destroy();
          this.otherSprites.delete(id);
        }
      }
      list.forEach((p) => {
        if (p.id === this.selfId) return;
        this.ensureOtherSprite(p);
      });
    });

    socket.on("player:moved", ({ id, x, y }) => {
      const entry = this.otherSprites.get(id);
      if (!entry) return;
      this.tweens.add({ targets: entry.container, x, y, duration: 120, ease: "Linear" });
    });

    socket.on("player:left", ({ id }) => {
      const entry = this.otherSprites.get(id);
      if (entry) {
        entry.container.destroy();
        this.otherSprites.delete(id);
      }
    });

    socket.on("fish:result", (result) => this.showResult(result));

    socket.on("chat:system", (text) => this.logChat(`• ${text}`));
    socket.on("chat:message", ({ name, text }) => this.logChat(`${name}: ${text}`));

    window.__joinGame = (name) => net.join(name);
    if (window.__pendingJoinName) {
      net.join(window.__pendingJoinName);
      window.__pendingJoinName = null;
    }
  }

  update(_, delta) {
    if (!this.targetPos) return;
    const c = this.selfContainer;
    const dx = this.targetPos.x - c.x;
    const dy = this.targetPos.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) return;

    const speed = 220; // px/sec
    const step = Math.min(dist, speed * (delta / 1000));
    const angle = Math.atan2(dy, dx);
    c.x += Math.cos(angle) * step;
    c.y += Math.sin(angle) * step;
    this.selfBoat.setRotation(angle + Math.PI / 2);

    // Throttle network updates
    this._lastSent = this._lastSent || 0;
    this._lastSent += delta;
    if (this._lastSent > 80) {
      this._lastSent = 0;
      net.move(c.x, c.y);
    }
  }
}
