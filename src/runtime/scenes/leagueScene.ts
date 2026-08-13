import Phaser from 'phaser';

type Phase = 'title' | 'draft' | 'match' | 'result';

interface Mutant {
  name: string;
  speed: number;
  power: number;
  vision: number;
}

const NAMES = [
  'Rook Claw',
  'Neon Fang',
  'Hex Bolt',
  'Flux Sable',
  'Pyro Vex',
  'Nova Thorne',
  'Ivy Kade',
  'Bram Jinx',
  'Echo Grimm',
  'Zed Rune',
];

export class LeagueScene extends Phaser.Scene {
  private phase: Phase = 'title';
  private titleText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private options: Mutant[] = [];
  private squad: Mutant[] = [];
  private cursor = 0;
  private matchClock = 0;
  private homeScore = 0;
  private awayScore = 0;
  private ball!: Phaser.GameObjects.Arc;
  private homeTeam: Phaser.GameObjects.Arc[] = [];
  private awayTeam: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('LeagueScene');
  }

  create(): void {
    this.drawBackdrop();

    this.titleText = this.add.text(640, 130, 'FC DNA\\nLEAGUE OF MUTANTS', {
      fontFamily: 'Georgia, serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffd147',
      align: 'center',
      stroke: '#3a1550',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.infoText = this.add.text(640, 560, 'Press SPACE to begin draft', {
      fontFamily: 'Verdana, sans-serif',
      fontSize: '28px',
      color: '#38e1ff',
      align: 'center',
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.phase === 'title') {
        this.startDraft();
      } else if (this.phase === 'draft') {
        this.pickCurrent();
      } else if (this.phase === 'result') {
        this.resetToTitle();
      }
    });

    this.input.keyboard?.on('keydown-UP', () => {
      if (this.phase === 'draft' && this.options.length > 0) {
        this.cursor = (this.cursor + this.options.length - 1) % this.options.length;
        this.renderDraftText();
      }
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.phase === 'draft' && this.options.length > 0) {
        this.cursor = (this.cursor + 1) % this.options.length;
        this.renderDraftText();
      }
    });
  }

  update(_: number, delta: number): void {
    if (this.phase !== 'match') {
      return;
    }

    this.matchClock += delta / 1000;
    this.simulateMovement(delta / 1000);

    if (this.matchClock >= 45 && this.homeScore + this.awayScore === 0) {
      this.homeScore = this.rollScore(this.teamStrength(this.squad));
      this.awayScore = this.rollScore(190);
    }

    const remaining = Math.max(0, Math.ceil(60 - this.matchClock));
    this.infoText.setText(
      `Mutants ${this.homeScore} - ${this.awayScore} Rivals   |   ${remaining}s`
    );

    if (this.matchClock >= 60) {
      this.showResult();
    }
  }

  private drawBackdrop(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0b0e1a, 0x0b0e1a, 0x102746, 0x102746, 1);
    bg.fillRect(0, 0, 1280, 720);

    const field = this.add.graphics();
    field.fillStyle(0x1c6b3c, 1);
    field.fillRoundedRect(140, 190, 1000, 420, 14);
    field.lineStyle(4, 0xeef3ff, 0.9);
    field.strokeRoundedRect(140, 190, 1000, 420, 14);
    field.lineBetween(640, 190, 640, 610);
    field.strokeCircle(640, 400, 70);
  }

  private startDraft(): void {
    this.phase = 'draft';
    this.squad = [];
    this.cursor = 0;
    this.options = this.makeMutants(4);
    this.titleText.setText('Draft Your Core Squad');
    this.renderDraftText();
  }

  private renderDraftText(): void {
    const lines = this.options.map((m, i) => {
      const marker = i === this.cursor ? '>' : ' ';
      return `${marker} ${m.name}  SPD:${m.speed}  POW:${m.power}  VIS:${m.vision}`;
    });

    this.infoText.setText([
      'Use UP/DOWN and SPACE to draft 3 mutants',
      '',
      ...lines,
      '',
      `Chosen: ${this.squad.map((m) => m.name).join(', ') || 'None yet'}`,
    ]);
  }

  private pickCurrent(): void {
    if (this.options.length === 0) {
      return;
    }

    const picked = this.options[this.cursor];
    this.squad.push(picked);
    this.options.splice(this.cursor, 1);
    this.cursor = Math.max(0, this.cursor - 1);

    if (this.squad.length >= 3) {
      this.startMatch();
      return;
    }

    while (this.options.length < 4) {
      this.options.push(...this.makeMutants(1));
    }

    this.renderDraftText();
  }

  private startMatch(): void {
    this.phase = 'match';
    this.matchClock = 0;
    this.homeScore = 0;
    this.awayScore = 0;
    this.titleText.setText('Match In Progress');

    this.homeTeam.forEach((p) => p.destroy());
    this.awayTeam.forEach((p) => p.destroy());

    this.homeTeam = this.spawnTeam(0x38e1ff, 260);
    this.awayTeam = this.spawnTeam(0xff2fb0, 820);

    this.ball?.destroy();
    this.ball = this.add.circle(640, 400, 8, 0xf4f7ff);

    this.infoText.setText('Kickoff...');
  }

  private spawnTeam(color: number, xBase: number): Phaser.GameObjects.Arc[] {
    return [0, 1, 2, 3, 4].map((i) =>
      this.add.circle(xBase + i * 40, 260 + i * 70, 14, color).setStrokeStyle(2, 0x0b0e1a)
    );
  }

  private simulateMovement(dt: number): void {
    const speed = 42 * dt;
    const jitter = () => Phaser.Math.FloatBetween(-18, 18) * dt;

    for (const p of this.homeTeam) {
      p.x = Phaser.Math.Clamp(p.x + speed + jitter(), 170, 620);
      p.y = Phaser.Math.Clamp(p.y + jitter(), 210, 590);
    }

    for (const p of this.awayTeam) {
      p.x = Phaser.Math.Clamp(p.x - speed + jitter(), 660, 1110);
      p.y = Phaser.Math.Clamp(p.y + jitter(), 210, 590);
    }

    const target = this.matchClock % 6 < 3 ? this.homeTeam[0] : this.awayTeam[0];
    this.ball.x += (target.x - this.ball.x) * 0.08;
    this.ball.y += (target.y - this.ball.y) * 0.08;
  }

  private teamStrength(team: Mutant[]): number {
    return team.reduce((sum, p) => sum + p.speed + p.power + p.vision, 0);
  }

  private rollScore(strength: number): number {
    const base = strength / 125;
    return Phaser.Math.Clamp(Math.round(base + Phaser.Math.Between(-1, 2)), 0, 6);
  }

  private showResult(): void {
    this.phase = 'result';
    const result = this.homeScore > this.awayScore
      ? 'Victory'
      : this.homeScore < this.awayScore
      ? 'Defeat'
      : 'Draw';

    this.titleText.setText('Full Time');
    this.infoText.setText([
      `Mutants ${this.homeScore} - ${this.awayScore} Rivals`,
      '',
      result,
      '',
      `Drafted: ${this.squad.map((m) => m.name).join(', ')}`,
      '',
      'Press SPACE to return to title',
    ]);
  }

  private resetToTitle(): void {
    this.phase = 'title';
    this.titleText.setText('FC DNA\\nLEAGUE OF MUTANTS');
    this.infoText.setText('Press SPACE to begin draft');
    this.homeTeam.forEach((p) => p.destroy());
    this.awayTeam.forEach((p) => p.destroy());
    this.homeTeam = [];
    this.awayTeam = [];
    this.ball?.destroy();
  }

  private makeMutants(count: number): Mutant[] {
    const result: Mutant[] = [];
    for (let i = 0; i < count; i += 1) {
      result.push({
        name: Phaser.Utils.Array.GetRandom(NAMES),
        speed: Phaser.Math.Between(50, 99),
        power: Phaser.Math.Between(50, 99),
        vision: Phaser.Math.Between(50, 99),
      });
    }
    return result;
  }
}
