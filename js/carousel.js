/* ==========================================
   carousel.js — Hero 卡片轮播
   效果：Element UI 卡片化轮播，中间大两侧小
   ========================================== */

(function() {
    var activeIndex = 0;
    var totalSlides = 4;
    var interval = 4000;
    var timer = null;

    var track = null;
    var cards = null;
    var indicators = null;

    /**
     * 根据 activeIndex 计算每张卡片的视觉位置
     * 位置规则（环形）：
     *   center  = activeIndex
     *   right   = (activeIndex + 1) % total
     *   hidden  = (activeIndex + 2) % total
     *   left    = (activeIndex + 3) % total   (= activeIndex - 1)
     */
    function getPosition(cardIndex, active) {
        var diff = (cardIndex - active + totalSlides) % totalSlides;
        if (diff === 0) return 'pos_center';
        if (diff === 1) return 'pos_right';
        if (diff === totalSlides - 1) return 'pos_left';
        return 'pos_hidden';
    }

    function updateCards() {
        for (var i = 0; i < cards.length; i++) {
            var pos = getPosition(i, activeIndex);
            cards[i].className = 'carousel_card ' + pos;
        }
        /* 更新指示器 */
        for (var j = 0; j < indicators.length; j++) {
            indicators[j].classList.toggle('active', j === activeIndex);
        }
    }

    function goTo(index) {
        if (index === activeIndex) return;
        activeIndex = index;
        updateCards();
        resetTimer();
    }

    function next() {
        activeIndex = (activeIndex + 1) % totalSlides;
        updateCards();
        resetTimer();
    }

    function resetTimer() {
        clearInterval(timer);
        timer = setInterval(next, interval);
    }

    function init() {
        track = document.getElementById('carousel_track');
        cards = document.querySelectorAll('.carousel_card');
        indicators = document.querySelectorAll('.indicator');

        if (!track || cards.length === 0) return;

        /* 初始状态 */
        updateCards();

        /* 指示器点击 */
        for (var i = 0; i < indicators.length; i++) {
            (function(idx) {
                indicators[idx].addEventListener('click', function() {
                    goTo(idx);
                });
            })(i);
        }

        /* 卡片点击跳到该卡片 */
        for (var j = 0; j < cards.length; j++) {
            (function(idx) {
                cards[idx].addEventListener('click', function() {
                    goTo(idx);
                });
            })(j);
        }

        /* 自动播放 */
        timer = setInterval(next, interval);

        /* 鼠标悬停暂停 */
        track.addEventListener('mouseenter', function() { clearInterval(timer); });
        track.addEventListener('mouseleave', function() { timer = setInterval(next, interval); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
