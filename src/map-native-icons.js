(function () {
  const SCALE = 2;
  const SIZE = 30;

  function canvasIcon(draw, size = SIZE) {
    const canvas = document.createElement('canvas');
    canvas.width = size * SCALE;
    canvas.height = size * SCALE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.scale(SCALE, SCALE);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx, size);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function badge(color, glyph) {
    return canvasIcon((ctx, size) => {
      const c = size / 2;
      ctx.shadowColor = 'rgba(15,23,42,.2)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(c, c, 10.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c, c, 8.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 1.8;
      glyph(ctx, c, c);
    });
  }

  const glyphs = {
    food(ctx, x, y) {
      ctx.beginPath(); ctx.moveTo(x - 3.5, y - 5); ctx.lineTo(x - 3.5, y + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 5.5, y - 5); ctx.lineTo(x - 5.5, y - 1.5); ctx.quadraticCurveTo(x - 3.5, y, x - 1.5, y - 1.5); ctx.lineTo(x - 1.5, y - 5); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + 3.2, y - 2.5, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3.2, y + .5); ctx.lineTo(x + 3.2, y + 5); ctx.stroke();
    },
    bed(ctx, x, y) {
      ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x - 6, y - 4); ctx.moveTo(x - 6, y + 1); ctx.lineTo(x + 6, y + 1); ctx.lineTo(x + 6, y + 4); ctx.moveTo(x - 3.5, y - 1); ctx.arc(x - 3.5, y - 1.5, 1.5, 0, Math.PI * 2); ctx.stroke();
    },
    medical(ctx, x, y) {
      ctx.fillRect(x - 2, y - 6, 4, 12); ctx.fillRect(x - 6, y - 2, 12, 4);
    },
    school(ctx, x, y) {
      ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x, y - 6); ctx.lineTo(x + 6, y - 3); ctx.lineTo(x, y); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 4, y + 4); ctx.quadraticCurveTo(x, y + 2, x, y + 5); ctx.quadraticCurveTo(x, y + 2, x + 4, y + 4); ctx.lineTo(x + 4, y); ctx.stroke();
    },
    shop(ctx, x, y) {
      ctx.beginPath(); ctx.rect(x - 5, y - 2, 10, 8); ctx.moveTo(x - 3.5, y - 2); ctx.quadraticCurveTo(x - 3.5, y - 6, x, y - 6); ctx.quadraticCurveTo(x + 3.5, y - 6, x + 3.5, y - 2); ctx.stroke();
    },
    transit(ctx, x, y) {
      ctx.beginPath(); ctx.roundRect(x - 5.5, y - 6, 11, 10, 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x + 3, y - 2); ctx.moveTo(x - 3.5, y + 6); ctx.lineTo(x - 2.5, y + 4); ctx.moveTo(x + 3.5, y + 6); ctx.lineTo(x + 2.5, y + 4); ctx.stroke();
    },
    civic(ctx, x, y) {
      ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.lineTo(x, y - 6); ctx.lineTo(x + 6, y - 2); ctx.closePath(); ctx.moveTo(x - 5, y + 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x - 3.5, y - 1); ctx.lineTo(x - 3.5, y + 4); ctx.moveTo(x, y - 1); ctx.lineTo(x, y + 4); ctx.moveTo(x + 3.5, y - 1); ctx.lineTo(x + 3.5, y + 4); ctx.stroke();
    },
    nature(ctx, x, y) {
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x - 5, y + 1); ctx.lineTo(x - 2, y + 1); ctx.lineTo(x - 6, y + 5); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x + 2, y + 1); ctx.lineTo(x + 5, y + 1); ctx.closePath(); ctx.stroke();
    },
    pin(ctx, x, y) {
      ctx.beginPath(); ctx.arc(x, y - 2, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2.8, y + 1); ctx.lineTo(x, y + 6); ctx.lineTo(x + 2.8, y + 1); ctx.stroke();
    }
  };

  function scenicIcon() {
    return canvasIcon((ctx, size) => {
      const c = size / 2;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#b45309'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c, c, 10.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 3 : 6.5; const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = c + Math.cos(a) * r; const py = c + Math.sin(a) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    });
  }

  function mountainIcon() {
    return canvasIcon((ctx, size) => {
      const c = size / 2;
      ctx.shadowColor = 'rgba(15,23,42,.22)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#15803d';
      ctx.beginPath(); ctx.moveTo(c, 4); ctx.lineTo(27, 25); ctx.lineTo(3, 25); ctx.closePath(); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(c, 4); ctx.lineTo(20, 13); ctx.lineTo(16.8, 11.2); ctx.lineTo(14.5, 14); ctx.lineTo(11.8, 11.3); ctx.lineTo(9.6, 13.2); ctx.closePath(); ctx.fill();
    });
  }

  function roadShield() {
    return canvasIcon((ctx) => {
      ctx.fillStyle = 'rgba(255,255,255,.97)'; ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(2, 5, 26, 20, 5); ctx.fill(); ctx.stroke();
    }, 30);
  }

  const definitions = {
    'outmap-poi-default': badge('#64748b', glyphs.pin),
    'outmap-poi-food': badge('#d97706', glyphs.food),
    'outmap-poi-lodging': badge('#d97706', glyphs.bed),
    'outmap-poi-medical': badge('#0284c7', glyphs.medical),
    'outmap-poi-school': badge('#7c3aed', glyphs.school),
    'outmap-poi-shop': badge('#059669', glyphs.shop),
    'outmap-poi-transit': badge('#2563eb', glyphs.transit),
    'outmap-poi-civic': badge('#475569', glyphs.civic),
    'outmap-poi-nature': badge('#0f766e', glyphs.nature),
    'outmap-poi-scenic': scenicIcon(),
    'outmap-mountain': mountainIcon(),
    'outmap-road-shield': roadShield()
  };

  function register(map) {
    Object.entries(definitions).forEach(([name, image]) => {
      if (map.hasImage(name)) return;
      const options = { pixelRatio: SCALE };
      if (name === 'outmap-road-shield') {
        options.stretchX = [[10, 50]];
        options.stretchY = [[10, 50]];
        options.content = [8, 8, 52, 52];
      }
      map.addImage(name, image, options);
    });
  }

  window.OutmapNativeIcons = Object.freeze({ register });
})();
