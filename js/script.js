// Replaces every <i data-lucide="..."> placeholder with its inline SVG.
// Must run before the carousels below capture/clone their slide content,
// so clones duplicate the real rendered icon, not the placeholder tag.
if (window.lucide) {
  lucide.createIcons();
}

(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var form = document.getElementById("booking-form");
  var errorBox = document.getElementById("form-error");
  var successBox = document.getElementById("form-success");
  var submitBtn = document.getElementById("form-submit");
  var pickupInput = document.getElementById("pickup");
  var dropoffInput = document.getElementById("dropoff");
  var categorySelect = document.getElementById("category");

  // Restrict date pickers to today onward, keep return >= pickup.
  var today = new Date().toISOString().split("T")[0];
  pickupInput.setAttribute("min", today);
  dropoffInput.setAttribute("min", today);

  pickupInput.addEventListener("change", function () {
    if (pickupInput.value) {
      dropoffInput.setAttribute("min", pickupInput.value);
      if (dropoffInput.value && dropoffInput.value < pickupInput.value) {
        dropoffInput.value = pickupInput.value;
      }
    }
  });

  // Clicking "Book" on a car card pre-selects that category and jumps to the form.
  document.querySelectorAll(".car-card [data-category]").forEach(function (link) {
    link.addEventListener("click", function () {
      var value = link.getAttribute("data-category");
      Array.prototype.forEach.call(categorySelect.options, function (opt) {
        if (opt.value.indexOf(value) === 0 || value.indexOf(opt.value) === 0) {
          categorySelect.value = opt.value;
        }
      });
    });
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearError();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (dropoffInput.value < pickupInput.value) {
      showError("Return date can't be before the pick-up date.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector(".btn__label").textContent = "Sending...";

    // Netlify Forms: submit as a normal URL-encoded POST to "/" so its
    // form-handling bot (which watched for this form at deploy time,
    // matched by the hidden form-name field) picks it up — same request
    // shape a plain HTML form submit would send, just done via fetch so we
    // can keep this custom success/error UI instead of a page reload.
    var body = new URLSearchParams(new FormData(form)).toString();

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Request failed");
        form.hidden = true;
        successBox.hidden = false;
        successBox.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function () {
        showError("Something went wrong sending your request. Please try again or call us at +30 22420 00000.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn__label").textContent = "Send request";
      });
  });
})();

// True circular carousel: every arrow click or dot shifts the window by
// exactly one real slide, in either direction, forever — [1,2,3] -> [2,3,4]
// -> [3,4,1] -> ... The loop-back is invisible because the track is padded
// with clones (as many as fit in one view) at both ends, so the moment the
// visible window drifts fully into clone territory we jump it by `count`
// slides with an instant (non-animated) scroll — landing on pixel-identical
// content, so nothing appears to move. Items-per-view is measured live from
// layout so this adapts from 1-up mobile to multi-up desktop, and rebuilds
// on resize. Used for the checklist, fleet, and reviews carousels.
function initLoopCarousel(trackId, dotsId, prevId, nextId) {
  "use strict";

  var track = document.getElementById(trackId);
  if (!track) return;

  var dotsWrap = document.getElementById(dotsId);
  var prevBtn = document.getElementById(prevId);
  var nextBtn = document.getElementById(nextId);

  // Captured once, before any clones exist — this is the real content and
  // never changes across rebuilds.
  var realSlides = Array.prototype.slice.call(track.children);
  var count = realSlides.length;

  var allSlides = [];
  var dots = [];
  var itemsPerView = 1;
  var animating = false;

  function gap() {
    return parseFloat(getComputedStyle(track).columnGap) || 0;
  }

  // Distance in px between one slide's start and the next.
  function step() {
    return realSlides[0].getBoundingClientRect().width + gap();
  }

  function computeItemsPerView() {
    return Math.max(1, Math.min(count, Math.round(track.clientWidth / step())));
  }

  function goTo(index, instant) {
    index = Math.max(0, Math.min(index, allSlides.length - 1));
    if (!instant) animating = true;
    track.scrollTo({ left: Math.round(index * step()), behavior: instant ? "auto" : "smooth" });
  }

  function currentIndex() {
    return Math.round(track.scrollLeft / step());
  }

  // Which real slide (0..count-1) currently sits at the start of the
  // visible window, wrapped into range.
  function activePosition(idx) {
    var pos = (idx - itemsPerView) % count;
    if (pos < 0) pos += count;
    return pos;
  }

  function updateDots(idx) {
    var pos = activePosition(idx);
    dots.forEach(function (dot, i) {
      dot.setAttribute("aria-current", i === pos ? "true" : "false");
    });
  }

  function settle() {
    var idx = currentIndex();
    // Clones sit at both ends, `itemsPerView` deep, so once the window has
    // drifted fully into clone territory, jump by exactly `count` to the
    // equivalent real position — instant and, since it's a clone of that
    // exact content, visually identical to what was already on screen.
    if (idx < itemsPerView) {
      goTo(idx + count, true);
      idx += count;
    } else if (idx >= itemsPerView + count) {
      goTo(idx - count, true);
      idx -= count;
    }
    updateDots(idx);
    animating = false;
  }

  // Ignored while a smooth scroll is already in flight, so rapid clicks
  // can't fire a second animation on top of the first and desync the loop.
  function step1(dir) {
    if (animating) return;
    goTo(currentIndex() + dir, false);
  }

  function goToPosition(pos) {
    if (animating) return;
    goTo(itemsPerView + pos, false);
  }

  function build() {
    itemsPerView = computeItemsPerView();

    // Rebuild the track as [clones of the tail][real slides][clones of the
    // head], cloning exactly as many slides as are visible at once — that's
    // what keeps the loop seamless at any items-per-view.
    while (track.firstChild) track.removeChild(track.firstChild);

    for (var i = 0; i < itemsPerView; i++) {
      var tailClone = realSlides[count - itemsPerView + i].cloneNode(true);
      tailClone.setAttribute("aria-hidden", "true");
      track.appendChild(tailClone);
    }
    realSlides.forEach(function (slide) {
      track.appendChild(slide);
    });
    for (var j = 0; j < itemsPerView; j++) {
      var headClone = realSlides[j].cloneNode(true);
      headClone.setAttribute("aria-hidden", "true");
      track.appendChild(headClone);
    }

    allSlides = Array.prototype.slice.call(track.children);

    // One dot per real slide — every real slide is a reachable, distinct
    // position in this circular model, so this is never off by one.
    dotsWrap.innerHTML = "";
    dots = [];
    for (var p = 0; p < count; p++) {
      (function (pos) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel__dot";
        dot.setAttribute("aria-label", "Go to slide " + (pos + 1));
        dot.addEventListener("click", function () {
          goToPosition(pos);
        });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      })(p);
    }

    goTo(itemsPerView, true); // land on the first real slide
    settle();
  }

  var scrollTimeout;
  track.addEventListener("scroll", function () {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(settle, 120);
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      step1(-1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      step1(1);
    });
  }

  // Desktop has no touch and the scrollbar is hidden, so give mouse users
  // click-and-drag to move the strip.
  var dragging = false;
  var startX = 0;
  var startScroll = 0;

  track.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "touch") return; // native touch scrolling handles this
    dragging = true;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("carousel__track--dragging");
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    track.scrollLeft = startScroll - (e.clientX - startX);
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("carousel__track--dragging");
    settle();
  }
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  build();

  // Items-per-view changes between mobile and desktop breakpoints, so the
  // page/clone/dot setup needs rebuilding whenever the viewport crosses one.
  var resizeTimeout;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(build, 150);
  });
}

initLoopCarousel("checklist-track", "checklist-dots", "checklist-prev", "checklist-next");
initLoopCarousel("fleet-track", "fleet-dots", "fleet-prev", "fleet-next");
initLoopCarousel("reviews-track", "reviews-dots", "reviews-prev", "reviews-next");
