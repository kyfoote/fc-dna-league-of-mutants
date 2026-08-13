// Game boot — the scene roster + Game.create + run().
import { Game } from '../engine/webgpu.js';
import { GAME_OPTIONS } from './config.js';
import { Title } from './scenes/title.js';
import { Draft } from './scenes/draft.js';
import { Hub } from './scenes/hub.js';
import { Play } from './scenes/play.js';
import { MatchResult } from './scenes/matchresult.js';
import { GameOver } from './scenes/gameover.js';

const game = await Game.create({
  ...GAME_OPTIONS,
  scenes: { title: Title, play: Play, gameOver: GameOver, draft: Draft, hub: Hub, matchresult: MatchResult },
});
game.run();
