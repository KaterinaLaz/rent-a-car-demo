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

// Loops infinitely — past the last card wraps to the first (and vice versa)
// — for swipe, drag, dots, and the prev/next buttons alike. Used for both
// the checklist and fleet carousels.
function initLoopCarousel(trackId, dotsId, prevId, nextId) {
  "use strict";

  var track = document.getElementById(trackId);
  if (!track) return;

  var dotsWrap = document.getElementById(dotsId);
  var prevBtn = document.getElementById(prevId);
  var nextBtn = document.getElementById(nextId);

  var realSlides = Array.prototype.slice.call(track.children);
  var count = realSlides.length;

  // Clone the first/last real slides to the opposite ends so scrolling past
  // an edge lands on a visual duplicate, which we then swap for the real
  // slide instantly (no animation) once the scroll settles — an invisible
  // seam that makes the strip feel endless.
  var firstClone = realSlides[0].cloneNode(true);
  var lastClone = realSlides[count - 1].cloneNode(true);
  firstClone.setAttribute("aria-hidden", "true");
  lastClone.setAttribute("aria-hidden", "true");
  track.appendChild(firstClone);
  track.insertBefore(lastClone, track.firstChild);

  var allSlides = Array.prototype.slice.call(track.children); // [lastClone, ...real, firstClone]

  realSlides.forEach(function (_, i) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel__dot";
    dot.setAttribute("aria-label", "Go to slide " + (i + 1));
    dot.addEventListener("click", function () {
      goTo(i + 1, false);
    });
    dotsWrap.appendChild(dot);
  });
  var dots = Array.prototype.slice.call(dotsWrap.children);

  // Distance in px between one slide's start and the next — used instead of
  // scrollIntoView/getBoundingClientRect comparisons, which can fight the
  // browser's own scroll-snap and end up not moving at all.
  function step() {
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return allSlides[1].getBoundingClientRect().width + gap;
  }

  function goTo(index, instant) {
    index = Math.max(0, Math.min(index, allSlides.length - 1));
    track.scrollTo({ left: Math.round(index * step()), behavior: instant ? "auto" : "smooth" });
  }

  function currentIndex() {
    return Math.round(track.scrollLeft / step());
  }

  function settle() {
    var idx = currentIndex();
    if (idx <= 0) {
      goTo(allSlides.length - 2, true); // landed on leading clone of last -> snap to real last
      idx = allSlides.length - 2;
    } else if (idx >= allSlides.length - 1) {
      goTo(1, true); // landed on trailing clone of first -> snap to real first
      idx = 1;
    }
    dots.forEach(function (dot, i) {
      dot.setAttribute("aria-current", i === idx - 1 ? "true" : "false");
    });
  }

  var scrollTimeout;
  track.addEventListener("scroll", function () {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(settle, 120);
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      goTo(currentIndex() - 1, false);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      goTo(currentIndex() + 1, false);
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

  goTo(1, true); // start on the first real slide, not the leading clone
  settle();
}

initLoopCarousel("checklist-track", "checklist-dots", "checklist-prev", "checklist-next");
initLoopCarousel("fleet-track", "fleet-dots", "fleet-prev", "fleet-next");
initLoopCarousel("reviews-track", "reviews-dots", "reviews-prev", "reviews-next");
