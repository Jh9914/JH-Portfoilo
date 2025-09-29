$(function () {
  'use strict';

  /* 0) Header slide-in */
  setTimeout(() => $('header').addClass('slide-down'), 100);

  /* 1) Cache DOM */
  const $win      = $(window);
  const $doc      = $(document);
  const $htmlBody = $('html, body');
  const $header   = $('header');
  const $sections = $('main > section');
  const $gnbLinks = $('.gnb > li > a');
  const $btnTop   = $('#btn_top');

  /* (모바일 네비: jQuery 버전 한 벌만 사용) */
  const $nav = $('nav.site-nav');
  if ($nav.length) {
    const open  = () => { $nav.addClass('is-open'); $('body').addClass('menu-open'); };
    const close = () => { $nav.removeClass('is-open'); $('body').removeClass('menu-open'); };

    $nav.find('.menu-btn').on('click', open);
    $nav.find('.close-btn, .nav-dim').on('click', close);
    $nav.find('.gnb a').on('click', close);           // 링크 눌러도 닫힘
    $(document).on('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* 2) Utils */
  const clamp   = (n, min, max) => Math.max(min, Math.min(max, n));
  const headerH = () => $header.outerHeight() || 0;
  const sectionTops = () =>
    $sections.map(function () { return Math.round($(this).offset().top); }).get();

  const rafThrottle = (fn) => {
    let rafId = null;
    return (...args) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; fn(...args); });
    };
  };
  function smoothScrollTo($target, duration = 550) {
  const top = Math.round($target.offset().top - headerH());
  $htmlBody.stop(true).animate({ scrollTop: top }, duration, 'swing');
  }  

  /* 3) State */
  let index = 0;
  let isAnimating = false;
  let tops = sectionTops();

  /* 3.5) 데스크탑에서만 페이징 ON (모바일/태블릿은 일반 스크롤) */
  const isDesktopLike = () =>
    window.matchMedia('(min-width: 1025px)').matches &&
    window.matchMedia('(pointer: fine)').matches;

  let pagingEnabled = isDesktopLike();
  const updatePagingEnabled = () => { pagingEnabled = isDesktopLike(); };
  window.addEventListener('resize', updatePagingEnabled);
  window.addEventListener('orientationchange', updatePagingEnabled);

  /* 4) Section paging helpers */
  function setActiveNav(i) {
    const id = $sections.eq(i).attr('id');
    if (!id) return;
    $gnbLinks.removeClass('is-active');
    $gnbLinks.filter(`[href="#${id}"]`).addClass('is-active');
  }

  function toggleTopBtn() {
    (index > 0 ? $btnTop.fadeIn(200) : $btnTop.fadeOut(200));
  }

  function scrollToIndex(i, pushHash = true) {
    index = clamp(i, 0, $sections.length - 1);
    const $target = $sections.eq(index);
    const top = Math.round($target.offset().top - headerH());

    isAnimating = true;
    $htmlBody.stop(true).animate({ scrollTop: top }, 700, 'swing', () => {
      isAnimating = false;
      setActiveNav(index);
      toggleTopBtn();
      if (pushHash) {
        const id = $target.attr('id');
        if (id) history.replaceState(null, '', '#' + id);
      }
    });
  }

  function syncIndexByScroll() {
    const st = $win.scrollTop() + headerH() + 1;
    let nearest = 0, minDiff = Infinity;
    for (let i = 0; i < tops.length; i++) {
      const d = Math.abs(tops[i] - st);
      if (d < minDiff) { minDiff = d; nearest = i; }
    }
    index = nearest;
    setActiveNav(index);
  }

  /* 5) Events */
  // (A) GNB 클릭 → 데스크탑에서만 페이징, 모바일은 기본 앵커 스크롤
  $gnbLinks.on('click', function (e) {
  e.preventDefault(); // 두 모드 모두 기본 점프 방지
  const $target = $(this.hash);
  if (!$target.length) return;

  // 사이드 메뉴가 열려 있으면 닫기
  $('nav.site-nav').removeClass('is-open');
  $('body').removeClass('menu-open');

  if (pagingEnabled) {
    // 데스크탑: 한 섹션씩 페이징
    const i = $sections.index($target);
    if (i >= 0) scrollToIndex(i);
  } else {
    // 모바일/태블릿: 부드러운 스크롤
    smoothScrollTo($target, 550);
  }
});

  // (B) Wheel → 데스크탑에서만 페이징
  $win.on('wheel', function (e) {
    if (!pagingEnabled) return;
    if (isAnimating) return;
    const dy = e.originalEvent.deltaY;
    if (Math.abs(dy) < 1) return;       // 트랙패드 미세값 무시
    scrollToIndex(index + (dy > 0 ? 1 : -1));
  });

  // (C) Touch swipe → 데스크탑(포인터 fine)에서만 페이징
  let touchStartY = null;
  $doc.on('touchstart', e => {
    if (!pagingEnabled || isAnimating) return;
    touchStartY = e.originalEvent.touches[0].clientY;
  });
  $doc.on('touchend', e => {
    if (!pagingEnabled || touchStartY == null || isAnimating) return;
    const diff = e.originalEvent.changedTouches[0].clientY - touchStartY;
    if (Math.abs(diff) >= 50) scrollToIndex(index + (diff < 0 ? 1 : -1));
    touchStartY = null;
  });

  // (D) Resize → 데스크탑일 때만 현재 섹션에 “고정” 보정
  $win.on('resize', rafThrottle(() => {
    tops = sectionTops();
    if (pagingEnabled) {
      const top = Math.round($sections.eq(index).offset().top - headerH());
      $htmlBody.stop(true).scrollTop(top);
    }
    toggleTopBtn();
  }));

  // (E) Scroll → 페이징 아닐 때도 active 메뉴 동기화
  $win.on('scroll', rafThrottle(() => {
    if (isAnimating) return;
    syncIndexByScroll();
    toggleTopBtn();
  }));

  // 초기 상태 (hash 존중)
  (function init() {
    const hash = window.location.hash;
    if (hash) {
      const $t = $(hash);
      const i  = $sections.index($t);
      if (i >= 0) {
        if (pagingEnabled) setTimeout(() => scrollToIndex(i, false), 50);
        // 모바일/태블릿은 기본 앵커 스크롤에 맡김
        return;
      }
    }
    syncIndexByScroll();
    toggleTopBtn();
  })();

  // 상단 버튼
  $btnTop.on('click', () => scrollToIndex(0));

  /* 7) Infinite marquee (skills) */
  (function initMarquee() {
    const rows = document.querySelectorAll('#skill .marquee .row');
    if (!rows.length) return;

    const setupAll = () => rows.forEach(setup);
    window.addEventListener('resize', setupAll);
    window.addEventListener('load',   setupAll);
    setupAll();

    function setup(row) {
      stop(row);

      const dirToken =
        (row.dataset.direction ||
         (row.classList.contains('row--ltr') ? 'ltr' :
          row.classList.contains('row--rtl') ? 'rtl' : 'rtl')).toLowerCase();
      const dir   = dirToken === 'ltr' ? 1 : -1;
      const speed = parseFloat(row.dataset.speed || '80');

      const group = row.querySelector('.group');
      if (!group) return;

      row.querySelectorAll('.group.__clone').forEach(el => el.remove());

      const baseWidth = group.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(row).gap || '0') || 0;
      let filled = baseWidth;

      while (filled < window.innerWidth * 2.5) {
        const clone = group.cloneNode(true);
        clone.classList.add('__clone');
        row.appendChild(clone);
        filled += baseWidth + gap;
      }

      const cycle = baseWidth + gap;
      let x = (dir > 0) ? -cycle : 0;
      let last = performance.now();

      function step(t) {
        const dt = (t - last) / 1000; last = t;
        x += dir * speed * dt;
        if (dir < 0 && x <= -cycle) x += cycle;
        if (dir > 0 && x >= 0)      x -= cycle;
        row.style.transform = `translateX(${x}px)`;
        row.__raf = requestAnimationFrame(step);
      }
      row.__raf = requestAnimationFrame(step);
    }

    function stop(row) {
      if (row.__raf) cancelAnimationFrame(row.__raf);
      row.__raf = null;
      row.style.transform = '';
      row.querySelectorAll('.group.__clone').forEach(el => el.remove());
    }
  })();

  /* 8) Fade-down reveal */
  (function fadeDown() {
    const els = document.querySelectorAll('.fade-down');
    if (!els.length) return;

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.2 });

    els.forEach(el => io.observe(el));
  })();

  /* 9) Contact – letters animation */
  (function splitLetters() {
    const targets = document.querySelectorAll('#contact .js-letters');
    if (!targets.length) return;

    targets.forEach(el => {
      const text = el.textContent;
      el.textContent = '';
      Array.from(text).forEach(ch => {
        const span = document.createElement('span');
        span.className = 'letter';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        el.appendChild(span);
      });
    });

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('.letter').forEach((s, i) => {
          setTimeout(() => s.classList.add('on'), i * 60);
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.3 });

    targets.forEach(el => io.observe(el));
  })();
});