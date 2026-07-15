import Phaser from "phaser";
import { net } from "./net.js";

const RARITY_COLORS = {
  common: "#cccccc",
  uncommon: "#4ecdc4",
  rare: "#ffe66d",
  legendary: "#ff6b6b",
};

// Coins awarded per catch, by rarity. Purely a client-side cosmetic reward
// for now (see the class-level comment on `this.coins` / `this.gems`).
const RARITY_COINS = { common: 15, uncommon: 40, rare: 90, legendary: 220 };
const QUEST_TARGET = 4; // catches per "quest" cycle, shown in the HUD ring

export class OceanScene extends Phaser.Scene {
  constructor() {
    super("OceanScene");
    this.otherSprites = new Map(); // id -> { container, label }
    this.worldSize = 1000;
    this.selfId = null;
    this.targetPos = null;
    this.fishing = false;

    // --- Cosmetic HUD economy -------------------------------------------
    // These live entirely on the client and reset on refresh. There's no
    // server-side wallet yet (server/index.js only tracks `catches`), so
    // treat this as a visual stub — wire it to real persisted state
    // (e.g. a `coins`/`gems` field on the server player object) when you're
    // ready to make it count for real.
    this.coins = 0;
    this.gems = 0;
    this.questProgress = 0;
    this.questTarget = QUEST_TARGET;
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

    // UI
    this.createFishButton();
    this.createHUD();
    this.layoutHUD();
    this.scale.on("resize", () => this.layoutHUD());

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

  // ---------------------------------------------------------------------
  // Fish button — rounded pill, drawn procedurally so it matches the rest
  // of the HUD's rounded/gold styling instead of a flat text box.
  // ---------------------------------------------------------------------
  createFishButton() {
    this.fishBtnWidth = 200;
    this.fishBtnHeight = 52;

    this.fishBtnBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.fishBtnText = this.add.text(0, 0, "🎣 Cast Line", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#06283d",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    this.drawFishButton(false);

    this.fishBtnHit = this.add.zone(0, 0, this.fishBtnWidth, this.fishBtnHeight)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });
    this.fishBtnHit.on("pointerdown", () => this.onFishButton());
  }

  drawFishButton(pressed) {
    const g = this.fishBtnBg;
    const w = this.fishBtnWidth;
    const h = this.fishBtnHeight;
    g.clear();
    // drop shadow
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, h / 2);
    // body
    g.fillStyle(pressed ? 0xe6c95a : 0xffe66d, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    // rim
    g.lineStyle(2, 0x06283d, 0.25);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  }

  onFishButton() {
    if (this.fishing) return;
    this.fishing = true;
    this.fishBtnText.setText("Casting…");
    this.drawFishButton(true);
    this.fishBtnHit.disableInteractive();
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
    this.fishBtnText.setText("🎣 Cast Line");
    this.drawFishButton(false);
    this.fishBtnHit.setInteractive({ useHandCursor: true });

    if (!result.success) {
      this.resultText.setText("The fish got away…").setColor("#ffffff").setVisible(true);
      this.time.delayedCall(1800, () => this.resultText.setVisible(false));
      return;
    }

    const c = result.catch;
    const color = RARITY_COLORS[c.rarity] || "#ffffff";
    this.resultText
      .setText(`Caught a ${c.name}!\n${c.size}cm (${c.rarity})`)
      .setColor(color)
      .setVisible(true);

    this.applyCatchRewards(c);

    this.time.delayedCall(1800, () => this.resultText.setVisible(false));
  }

  // Updates the cosmetic coin/gem/quest HUD after a successful catch.
  applyCatchRewards(c) {
    const coinsEarned = (RARITY_COINS[c.rarity] || 10) + Math.round(c.size / 5);
    this.coins += coinsEarned;
    this.coinPill.text.setText(String(this.coins));
    this.redrawPill(this.coinPill);

    this.questProgress += 1;
    let questComplete = false;
    if (this.questProgress >= this.questTarget) {
      this.questProgress = 0;
      this.gems += 1;
      questComplete = true;
    }
    if (c.rarity === "legendary") this.gems += 2;
    this.gemPill.text.setText(String(this.gems));
    this.redrawPill(this.gemPill);

    this.questText.setText(`${this.questProgress}/${this.questTarget}`);
    this.drawQuestRing();

    this.layoutHUD(); // pill widths may have changed with the new numbers

    if (questComplete) this.logChat("✨ Quest complete! +1 gem");
    this.logChat(`+${coinsEarned} coins`);
  }

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------
  createHUD() {
    this.createAvatarCluster();
    this.createCurrencyHUD();
    this.createBottomRightHUD();

    this.chatLog = this.add.text(10, 10, "Welcome to the waters! 🌊", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#ffffff",
      backgroundColor: "#06283dcc",
      padding: { x: 10, y: 7 },
      wordWrap: { width: 240 },
    }).setScrollFactor(0).setAlpha(0.92).setDepth(100);
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

  logChat(text) {
    this.chatMessages.push(text);
    if (this.chatMessages.length > 5) this.chatMessages.shift();
    this.chatLog.setText(this.chatMessages.join("\n"));
  }

  // --- Avatar + quest tracker (top-left) --------------------------------
  createAvatarCluster() {
    this.avatarRadius = 28;
    this.avatarGraphics = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.drawAvatar();

    this.questRadius = 22;
    this.questGraphics = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.questIcon = this.add.text(0, 0, "🐟", { fontSize: "18px" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.questText = this.add.text(0, 0, `${this.questProgress}/${this.questTarget}`, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.drawQuestRing();
  }

  drawAvatar() {
    const g = this.avatarGraphics;
    const r = this.avatarRadius;
    g.clear();
    // soft outer glow
    g.fillStyle(0x06283d, 0.35);
    g.fillCircle(0, 0, r + 4);
    // gold border ring
    g.fillStyle(0xffe66d, 1);
    g.fillCircle(0, 0, r);
    // face
    g.fillStyle(0xf6c99b, 1);
    g.fillCircle(0, 0, r - 4);
    // captain's hat
    g.fillStyle(0x2f4858, 1);
    g.fillEllipse(0, -r * 0.32, r * 1.3, r * 0.4);
    g.fillStyle(0x3a5568, 1);
    g.fillRoundedRect(-r * 0.55, -r - 2, r * 1.1, r * 0.55, 4);
    // eyes
    g.fillStyle(0x1c1c1c, 1);
    g.fillCircle(-r * 0.28, r * 0.08, 2.5);
    g.fillCircle(r * 0.28, r * 0.08, 2.5);
    // smile
    g.lineStyle(2, 0x8a4a2b, 1);
    g.beginPath();
    g.arc(0, r * 0.12, r * 0.35, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
    g.strokePath();
  }

  drawQuestRing() {
    const g = this.questGraphics;
    const r = this.questRadius;
    g.clear();
    // track
    g.lineStyle(4, 0x0e4a73, 1);
    g.strokeCircle(0, 0, r);
    // progress arc
    const pct = Phaser.Math.Clamp(this.questProgress / this.questTarget, 0, 1);
    if (pct > 0) {
      g.lineStyle(4, 0x4ecdc4, 1);
      g.beginPath();
      const start = Phaser.Math.DegToRad(-90);
      const end = start + Phaser.Math.PI2 * pct;
      g.arc(0, 0, r, start, end, false);
      g.strokePath();
    }
    // inner disc so only the ring itself shows as progress
    g.fillStyle(0x06283d, 1);
    g.fillCircle(0, 0, r - 6);
  }

  // --- Currency pills (top-right) ---------------------------------------
  createCurrencyHUD() {
    this.gemPill = this.makeCurrencyPill("💎", 0xff6bcb, this.gems);
    this.coinPill = this.makeCurrencyPill("🪙", 0xffd23f, this.coins);
  }

  makeCurrencyPill(glyph, iconColor, value) {
    const iconR = 16;
    const height = 32;
    const pill = {
      bg: this.add.graphics().setScrollFactor(0).setDepth(100),
      icon: this.add.text(0, 0, glyph, { fontSize: "16px" }).setOrigin(0.5).setScrollFactor(0).setDepth(102),
      text: this.add.text(0, 0, String(value), {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffffff",
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101),
      iconColor,
      iconR,
      height,
      paddingLeft: iconR * 2 + 10,
      paddingRight: 14,
      width: 0,
    };
    this.redrawPill(pill);
    return pill;
  }

  redrawPill(pill) {
    const width = Math.max(70, pill.paddingLeft + pill.text.width + pill.paddingRight);
    pill.width = width;
    const g = pill.bg;
    g.clear();
    g.fillStyle(0x06283d, 0.72);
    g.fillRoundedRect(0, -pill.height / 2, width, pill.height, pill.height / 2);
    g.lineStyle(1.5, 0xffffff, 0.15);
    g.strokeRoundedRect(0, -pill.height / 2, width, pill.height, pill.height / 2);
    g.fillStyle(pill.iconColor, 1);
    g.fillCircle(pill.iconR, 0, pill.iconR);
    g.lineStyle(1.5, 0xffffff, 0.25);
    g.strokeCircle(pill.iconR, 0, pill.iconR);
  }

  positionPill(pill, x, y) {
    pill.bg.setPosition(x, y);
    pill.icon.setPosition(x + pill.iconR, y);
    pill.text.setPosition(x + pill.paddingLeft, y);
  }

  // --- Bottom-right icon buttons (backpack / chat) -----------------------
  createBottomRightHUD() {
    this.backpackBtn = this.makeIconButton("🎒", 0x3a5568, 24);
    this.chatBtn = this.makeIconButton("💬", 0x3a5568, 22, () => {
      this.chatLog.setVisible(!this.chatLog.visible);
    });

    this.backpackBadgeBg = this.add.graphics().setScrollFactor(0).setDepth(102);
    this.backpackBadgeBg.fillStyle(0x06283d, 0.85);
    this.backpackBadgeBg.fillRoundedRect(-19, -10, 38, 20, 10);
    this.backpackBadgeBg.lineStyle(1, 0xffffff, 0.2);
    this.backpackBadgeBg.strokeRoundedRect(-19, -10, 38, 20, 10);

    this.backpackBadgeText = this.add.text(0, 0, "0/5", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(103);
  }

  makeIconButton(glyph, bgColor, radius, onTap) {
    const g = this.add.graphics().setScrollFactor(0).setDepth(100);
    g.fillStyle(0x06283d, 0.5);
    g.fillCircle(0, 0, radius + 3);
    g.fillStyle(bgColor, 0.92);
    g.fillCircle(0, 0, radius);
    g.lineStyle(1.5, 0xffffff, 0.2);
    g.strokeCircle(0, 0, radius);

    const icon = this.add.text(0, 0, glyph, { fontSize: `${Math.round(radius)}px` })
      .setOrigin(0.5).setScrollFactor(0).setDepth(101);

    const hit = this.add.zone(0, 0, radius * 2, radius * 2)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });
    if (onTap) hit.on("pointerdown", onTap);

    return { g, icon, hit, radius };
  }

  // --- Master layout pass -------------------------------------------------
  layoutHUD() {
    const w = this.scale.width;
    const h = this.scale.height;
    const margin = 16;

    if (this.fishBtnBg) {
      const x = w / 2;
      const y = h - 24 - this.fishBtnHeight / 2;
      this.fishBtnBg.setPosition(x, y);
      this.fishBtnText.setPosition(x, y);
      this.fishBtnHit.setPosition(x, y);
    }

    if (this.resultText) this.resultText.setPosition(w / 2, h / 2);

    if (this.avatarGraphics) {
      const avatarX = margin + this.avatarRadius;
      const avatarY = margin + this.avatarRadius;
      this.avatarGraphics.setPosition(avatarX, avatarY);

      const questX = avatarX + this.avatarRadius + 10 + this.questRadius;
      const questY = avatarY;
      this.questGraphics.setPosition(questX, questY);
      this.questIcon.setPosition(questX, questY - 2);
      this.questText.setPosition(questX, questY + this.questRadius + 12);
    }

    if (this.coinPill && this.gemPill) {
      const topY = margin + this.coinPill.height / 2;
      let rightX = w - margin - this.coinPill.width;
      this.positionPill(this.coinPill, rightX, topY);
      rightX -= this.gemPill.width + 8;
      this.positionPill(this.gemPill, rightX, topY);
    }

    if (this.backpackBtn) {
      const bpX = w - margin - this.backpackBtn.radius;
      const bpY = h - margin - this.backpackBtn.radius - 26; // room for badge below
      this.backpackBtn.g.setPosition(bpX, bpY);
      this.backpackBtn.icon.setPosition(bpX, bpY);
      this.backpackBtn.hit.setPosition(bpX, bpY);

      const badgeY = bpY + this.backpackBtn.radius + 14;
      this.backpackBadgeBg.setPosition(bpX, badgeY);
      this.backpackBadgeText.setPosition(bpX, badgeY);

      const chatY = bpY - this.backpackBtn.radius - 16 - this.chatBtn.radius;
      this.chatBtn.g.setPosition(bpX, chatY);
      this.chatBtn.icon.setPosition(bpX, chatY);
      this.chatBtn.hit.setPosition(bpX, chatY);
    }

    if (this.chatLog) {
      const logY = margin + this.avatarRadius * 2 + 30;
      this.chatLog.setPosition(10, logY);
    }
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
