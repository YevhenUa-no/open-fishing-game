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
    this.otherEntries = new Map(); // id -> { container, boat, label, hpBarBg, hpBarFill, hp, alive }
    this.coinSprites = new Map(); // coinId -> gfx container
    this.worldSize = 1000;
    this.maxHp = 100;
    this.selfId = null;
    this.targetPos = null;
    this.fishing = false;
<<<<<<< HEAD
    this.selfHp = 100;
    this.selfCoins = 0;
    this.selfAlive = true;
    this.facingAngle = -Math.PI / 2;
=======

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
>>>>>>> origin/main
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor("#0a3d62");
    this.drawWaterBackground();
    this.spawnSparkles();

    this.selfContainer = this.add.container(500, 500);
    this.selfBoat = this.makeBoat("#ffe66d", true);
    this.selfContainer.add(this.selfBoat);

    this.selfHpBarBg = this.add.rectangle(0, -46, 40, 6, 0x000000, 0.5).setOrigin(0.5);
    this.selfHpBarFill = this.add.rectangle(-20, -46, 40, 6, 0x4ecdc4).setOrigin(0, 0.5);
    this.selfLabel = this.add.text(0, -60, "You", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#00000066",
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5);
    this.selfContainer.add([this.selfHpBarBg, this.selfHpBarFill, this.selfLabel]);

    this.cameras.main.startFollow(this.selfContainer, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    this.input.on("pointerdown", (pointer) => this.handlePointer(pointer));
    this.input.on("pointermove", (pointer) => {
      if (pointer.isDown) this.handlePointer(pointer);
    });

<<<<<<< HEAD
=======
    // UI
>>>>>>> origin/main
    this.createFishButton();
    this.createShootButton();
    this.createHUD();
<<<<<<< HEAD
=======
    this.layoutHUD();
    this.scale.on("resize", () => this.layoutHUD());

    // Networking hooks
>>>>>>> origin/main
    this.setupNetworking();
  }

  // ---- Visuals -----------------------------------------------------------

  drawWaterBackground() {
    const g = this.add.graphics();
    const tile = 50;
    for (let x = 0; x < this.worldSize + tile; x += tile) {
      for (let y = 0; y < this.worldSize + tile; y += tile) {
        const t = (x / this.worldSize + y / this.worldSize) / 2;
        const base = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor("#0f5c8a"),
          Phaser.Display.Color.ValueToColor("#082f4a"),
          100,
          Math.floor(t * 100)
        );
        const checker = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0;
        const shade = checker
          ? Phaser.Display.Color.GetColor(base.r + 8, base.g + 8, base.b + 10)
          : Phaser.Display.Color.GetColor(base.r, base.g, base.b);
        g.fillStyle(shade, 1);
        g.fillRect(x, y, tile, tile);
      }
    }
    g.lineStyle(6, 0x06283d, 1);
    g.strokeRect(0, 0, this.worldSize, this.worldSize);
  }

  spawnSparkles() {
    this.sparkles = this.add.group();
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * this.worldSize;
      const y = Math.random() * this.worldSize;
      const s = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.15, 0.4));
      this.sparkles.add(s);
      this.tweens.add({
        targets: s,
        alpha: { from: s.alpha, to: 0.05 },
        duration: Phaser.Math.Between(1500, 3500),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  makeBoat(color, isSelf = false) {
    const c = this.add.container(0, 0);
    const wake = this.add.ellipse(0, 16, 26, 10, 0xffffff, 0.22);
    const hullColor = Phaser.Display.Color.HexStringToColor(color).color;
    const hull = this.add.graphics();
    hull.fillStyle(hullColor, 1);
    hull.lineStyle(2, 0x06283d, 1);
    // Hull: rounded boat shape pointing up (0 angle = facing up/-Y)
    hull.beginPath();
    hull.moveTo(0, -18);
    hull.lineTo(11, 6);
    hull.lineTo(9, 12);
    hull.lineTo(-9, 12);
    hull.lineTo(-11, 6);
    hull.closePath();
    hull.fillPath();
    hull.strokePath();
    // Cabin
    const cabin = this.add.rectangle(0, 2, 10, 8, 0xffffff, 0.85).setStrokeStyle(1, 0x06283d);
    c.add([wake, hull, cabin]);
    if (isSelf) {
      const ring = this.add.circle(0, 0, 16, 0xffffff, 0).setStrokeStyle(1.5, 0xffffff, 0.35);
      c.add(ring);
    }
    return c;
  }

  makeCoinSprite(coin) {
    const c = this.add.container(coin.x, coin.y);
    const glow = this.add.circle(0, 0, 12, 0xffd93d, 0.25);
    const disc = this.add.circle(0, 0, 8, 0xffd93d).setStrokeStyle(2, 0xb8860b);
    const shine = this.add.circle(-2, -2, 2, 0xffffff, 0.9);
    c.add([glow, disc, shine]);
    this.tweens.add({
      targets: c,
      y: coin.y - 4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    return c;
  }

  // ---- Input ---------------------------------------------------------------

  handlePointer(pointer) {
    if (this.fishing || !this.selfAlive) return;
    if (this.isPointerOverHud(pointer)) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.targetPos = {
      x: Phaser.Math.Clamp(world.x, 0, this.worldSize),
      y: Phaser.Math.Clamp(world.y, 0, this.worldSize),
    };
  }

<<<<<<< HEAD
  isPointerOverHud(pointer) {
    const btns = [this.fishBtn, this.shootBtn].filter(Boolean);
    return btns.some((b) => b.getBounds().contains(pointer.x, pointer.y));
  }

  // ---- HUD -----------------------------------------------------------------

=======
  // ---------------------------------------------------------------------
  // Fish button — rounded pill, drawn procedurally so it matches the rest
  // of the HUD's rounded/gold styling instead of a flat text box.
  // ---------------------------------------------------------------------
>>>>>>> origin/main
  createFishButton() {
    this.fishBtnWidth = 200;
    this.fishBtnHeight = 52;

    this.fishBtnBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.fishBtnText = this.add.text(0, 0, "🎣 Cast Line", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
<<<<<<< HEAD
      backgroundColor: "#ffe66d",
      color: "#06283d",
      padding: { x: 14, y: 9 },
    })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(100);
    this.fishBtn.on("pointerdown", () => this.onFishButton());

    this.scale.on("resize", () => this.layoutHUD());
    this.layoutHUD();
  }

  createShootButton() {
    this.shootBtn = this.add.text(0, 0, "🔫 Fire", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      backgroundColor: "#ff6b6b",
      color: "#ffffff",
      padding: { x: 18, y: 9 },
    })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(100);
    this.shootBtn.on("pointerdown", () => this.onShootButton());
    this.layoutHUD();
  }

  createHUD() {
    this.chatLog = this.add.text(10, 46, "Welcome to the waters! 🌊", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 8, y: 6 },
      wordWrap: { width: 240 },
    }).setScrollFactor(0).setAlpha(0.85).setDepth(100);
    this.chatMessages = [];

    this.statsText = this.add.text(10, 10, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "15px",
      color: "#ffffff",
      backgroundColor: "#00000099",
      padding: { x: 8, y: 5 },
    }).setScrollFactor(0).setDepth(100);
    this.updateStatsText();

    this.resultText = this.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      color: "#ffffff",
      backgroundColor: "#000000cc",
      padding: { x: 14, y: 10 },
      align: "center",
    }).setScrollFactor(0).setOrigin(0.5).setDepth(200).setVisible(false);
  }

  updateStatsText() {
    this.statsText.setText(`💰 ${this.selfCoins}   ❤️ ${this.selfHp}/${this.maxHp}`);
  }

  layoutHUD() {
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.fishBtn) this.fishBtn.setPosition(w / 2 - this.fishBtn.width - 10, h - this.fishBtn.height - 24);
    if (this.shootBtn) this.shootBtn.setPosition(w / 2 + 10, h - this.shootBtn.height - 24);
    if (this.resultText) this.resultText.setPosition(w / 2, h / 2);
  }

  logChat(text) {
    this.chatMessages.push(text);
    if (this.chatMessages.length > 5) this.chatMessages.shift();
    this.chatLog.setText(this.chatMessages.join("\n"));
=======
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
>>>>>>> origin/main
  }

  // ---- Fishing ---------------------------------------------------------------

  onFishButton() {
    if (this.fishing || !this.selfAlive) return;
    this.fishing = true;
    this.fishBtnText.setText("Casting…");
    this.drawFishButton(true);
    this.fishBtnHit.disableInteractive();
    net.castLine();
    this.startMinigame();
  }

  startMinigame() {
    const w = this.scale.width;
    const h = this.scale.height;
    const barWidth = Math.min(280, w - 60);
    const barY = h - 130;

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
    const speed = 260;
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
      const accuracy = Phaser.Math.Clamp(1 - dist / (sweetSpotWidth * 1.5), 0, 1);
      this.input.off("pointerdown", tapHandler);
      finish(accuracy);
    };
    this.input.on("pointerdown", tapHandler);

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

<<<<<<< HEAD
  // ---- Shooting -----------------------------------------------------------

  onShootButton() {
    if (!this.selfAlive) return;
    net.shoot(this.facingAngle);
    this.fireVisualEffect(this.selfContainer.x, this.selfContainer.y, this.facingAngle, true);
  }

  fireVisualEffect(x, y, angle, isSelf) {
    const length = 260;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    const line = this.add.line(0, 0, x, y, endX, endY, isSelf ? 0xffe66d : 0xff6b6b, 0.7)
      .setLineWidth(2)
      .setOrigin(0, 0);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 220,
      onComplete: () => line.destroy(),
    });
  }

  // ---- Other players --------------------------------------------------------

  ensureOtherEntry(p) {
    if (this.otherEntries.has(p.id)) return this.otherEntries.get(p.id);
=======
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
>>>>>>> origin/main
    const container = this.add.container(p.x, p.y);
    const boat = this.makeBoat(p.color || "#4ecdc4");
    const hpBarBg = this.add.rectangle(0, -46, 40, 6, 0x000000, 0.5).setOrigin(0.5);
    const hpBarFill = this.add.rectangle(-20, -46, 40, 6, 0x4ecdc4).setOrigin(0, 0.5);
    const label = this.add.text(0, -60, p.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#00000066",
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5);
    container.add([boat, hpBarBg, hpBarFill, label]);
    const entry = { container, boat, hpBarBg, hpBarFill, label, hp: p.hp ?? this.maxHp, alive: p.alive !== false };
    this.otherEntries.set(p.id, entry);
    this.setEntryHp(entry, entry.hp);
    if (!entry.alive) container.setAlpha(0.3);
    return entry;
  }

  setEntryHp(entry, hp) {
    entry.hp = hp;
    const pct = Phaser.Math.Clamp(hp / this.maxHp, 0, 1);
    entry.hpBarFill.width = 40 * pct;
    entry.hpBarFill.fillColor = pct > 0.5 ? 0x4ecdc4 : pct > 0.2 ? 0xffe66d : 0xff6b6b;
  }

  setSelfHp(hp) {
    this.selfHp = hp;
    const pct = Phaser.Math.Clamp(hp / this.maxHp, 0, 1);
    this.selfHpBarFill.width = 40 * pct;
    this.selfHpBarFill.fillColor = pct > 0.5 ? 0x4ecdc4 : pct > 0.2 ? 0xffe66d : 0xff6b6b;
    this.updateStatsText();
  }

  // ---- Networking -----------------------------------------------------------

  setupNetworking() {
    const socket = net.connect();

    socket.on("world:init", (data) => {
      this.selfId = data.selfId;
      this.worldSize = data.worldSize;
      this.maxHp = data.maxHp || 100;

      const selfP = data.players.find((p) => p.id === data.selfId);
      if (selfP) {
        this.selfContainer.setPosition(selfP.x, selfP.y);
        this.targetPos = { x: selfP.x, y: selfP.y };
        this.setSelfHp(selfP.hp ?? this.maxHp);
        this.selfCoins = selfP.coins ?? 0;
        this.selfAlive = selfP.alive !== false;
        this.updateStatsText();
      }
      data.players.forEach((p) => {
        if (p.id === data.selfId) return;
        this.ensureOtherEntry(p);
      });

      (data.coins || []).forEach((coin) => {
        if (this.coinSprites.has(coin.id)) return;
        this.coinSprites.set(coin.id, this.makeCoinSprite(coin));
      });

      this.logChat(`Connected. ${data.players.length} angler(s) online.`);
    });

    socket.on("players:update", (list) => {
      const ids = new Set(list.map((p) => p.id));
      for (const [id, entry] of this.otherEntries) {
        if (!ids.has(id) && id !== this.selfId) {
          entry.container.destroy();
          this.otherEntries.delete(id);
        }
      }
      list.forEach((p) => {
        if (p.id === this.selfId) return;
        this.ensureOtherEntry(p);
      });
    });

    socket.on("player:moved", ({ id, x, y }) => {
      const entry = this.otherEntries.get(id);
      if (!entry) return;
      this.tweens.add({ targets: entry.container, x, y, duration: 120, ease: "Linear" });
    });

    socket.on("player:left", ({ id }) => {
      const entry = this.otherEntries.get(id);
      if (entry) {
        entry.container.destroy();
        this.otherEntries.delete(id);
      }
    });

    socket.on("fish:result", (result) => this.showResult(result));

    socket.on("coin:collected", ({ coinId, by, coins: coinCount }) => {
      const sprite = this.coinSprites.get(coinId);
      if (sprite) {
        sprite.destroy();
        this.coinSprites.delete(coinId);
      }
      if (by === this.selfId) {
        this.selfCoins = coinCount;
        this.updateStatsText();
      }
    });

    socket.on("coin:spawned", (coin) => {
      if (this.coinSprites.has(coin.id)) return;
      this.coinSprites.set(coin.id, this.makeCoinSprite(coin));
    });

    socket.on("player:shotFired", ({ id, angle }) => {
      if (id === this.selfId) return; // self already shown instantly
      const entry = this.otherEntries.get(id);
      if (!entry) return;
      this.fireVisualEffect(entry.container.x, entry.container.y, angle, false);
    });

    socket.on("player:hit", ({ id, hp }) => {
      if (id === this.selfId) {
        this.setSelfHp(hp);
        this.cameras.main.shake(120, 0.005);
      } else {
        const entry = this.otherEntries.get(id);
        if (entry) this.setEntryHp(entry, hp);
      }
    });

    socket.on("player:eliminated", ({ id, name }) => {
      if (id === this.selfId) {
        this.selfAlive = false;
        this.selfContainer.setAlpha(0.3);
        this.resultText.setText(`You were sunk!\nRespawning…`).setColor("#ff6b6b").setVisible(true);
      } else {
        const entry = this.otherEntries.get(id);
        if (entry) entry.container.setAlpha(0.3);
      }
      this.logChat(`💥 ${name} was sunk!`);
    });

    socket.on("player:respawned", (p) => {
      if (p.id === this.selfId) {
        this.selfAlive = true;
        this.selfContainer.setAlpha(1);
        this.selfContainer.setPosition(p.x, p.y);
        this.targetPos = { x: p.x, y: p.y };
        this.setSelfHp(p.hp);
        this.resultText.setVisible(false);
      } else {
        const entry = this.otherEntries.get(p.id);
        if (entry) {
          entry.container.setAlpha(1);
          entry.container.setPosition(p.x, p.y);
          this.setEntryHp(entry, p.hp);
        }
      }
    });

    socket.on("chat:system", (text) => this.logChat(`• ${text}`));
    socket.on("chat:message", ({ name, text }) => this.logChat(`${name}: ${text}`));

    window.__joinGame = (name) => net.join(name);
    if (window.__pendingJoinName) {
      net.join(window.__pendingJoinName);
      window.__pendingJoinName = null;
    }
  }

  update(_, delta) {
    if (!this.targetPos || !this.selfAlive) return;
    const c = this.selfContainer;
    const dx = this.targetPos.x - c.x;
    const dy = this.targetPos.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) return;

    const speed = 220;
    const step = Math.min(dist, speed * (delta / 1000));
    const angle = Math.atan2(dy, dx);
    c.x += Math.cos(angle) * step;
    c.y += Math.sin(angle) * step;
    this.selfBoat.setRotation(angle + Math.PI / 2);
    this.facingAngle = angle;

    this._lastSent = this._lastSent || 0;
    this._lastSent += delta;
    if (this._lastSent > 80) {
      this._lastSent = 0;
      net.move(c.x, c.y);
    }
  }
}
