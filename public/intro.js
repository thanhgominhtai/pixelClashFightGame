(function bootGameIntro() {
  'use strict';

  const intro = document.getElementById('game-intro');
  const video = document.getElementById('game-intro-video');
  const app = document.getElementById('app');
  if (!intro || !video || !app) {
    app?.removeAttribute('inert');
    return;
  }

  let finished = false;

  function finishIntro() {
    if (finished) return;
    finished = true;
    video.pause();
    intro.classList.add('is-leaving');
    app.removeAttribute('inert');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 330;
    window.setTimeout(() => {
      intro.hidden = true;
      document.getElementById('launch-match')?.focus({ preventScroll: true });
    }, delay);
  }

  async function playAudibly() {
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
      return true;
    } catch (_error) {
      return false;
    }
  }

  video.addEventListener('ended', finishIntro);
  video.addEventListener('error', () => window.setTimeout(finishIntro, 350));
  intro.addEventListener('click', () => {
    if (video.paused) {
      void playAudibly();
    }
  });

  void playAudibly();
}());
