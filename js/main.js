import { UI } from './ui/UI.js';
import { App } from './core/App.js';

const ui = new UI();

if (!window.THREE) {
  ui.error('Three.js 加载失败，请检查网络后刷新。');
} else {
  const app = new App(document.getElementById('app'), ui);
  app.init().catch((err) => {
    console.error(err);
    ui.error(`加载失败：${err.message}`);
  });
  window.pumpkin = app;
}
