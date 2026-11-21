/* ==========================================================================
   ЛОГИКА ПРИЛОЖЕНИЯ «ШКОЛЬНЫЙ НАВИГАТОР №60»
   ========================================================================== */

(function () {
  "use strict";

  const DATA = window.SCHOOL_DATA;
  if (!DATA) return;

  function initNavigation() {
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("mainNav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function initScrollReveal() {
    const elements = document.querySelectorAll(".reveal-on-scroll");
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    elements.forEach((el) => observer.observe(el));
  }

  function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function formatSeconds(totalSec) {
    const safe = Math.max(0, Math.floor(totalSec));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function getScheduleState(nowDate) {
    const schedule = DATA.bellScheduleFriday;
    const currentSec =
      nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds();

    const firstStartSec = timeToMinutes(schedule[0].start) * 60;
    const lastEndSec = timeToMinutes(schedule[schedule.length - 1].end) * 60;

    if (currentSec < firstStartSec) {
      return {
        mode: "before",
        title: "Уроки ещё не начались",
        subtitle: `1-й урок начнётся в ${schedule[0].start}`,
        secondsLeft: firstStartSec - currentSec,
        progress: 0,
        currentLesson: null,
        nextLesson: schedule[0].lesson
      };
    }

    if (currentSec >= lastEndSec) {
      return {
        mode: "after",
        title: "Занятия завершены",
        subtitle: `Последний (10-й) урок окончился в ${schedule[schedule.length - 1].end}`,
        secondsLeft: 0,
        progress: 100,
        currentLesson: null,
        nextLesson: null
      };
    }

    for (let i = 0; i < schedule.length; i++) {
      const item = schedule[i];
      const startSec = timeToMinutes(item.start) * 60;
      const endSec = timeToMinutes(item.end) * 60;

      if (currentSec >= startSec && currentSec < endSec) {
        const total = endSec - startSec;
        const elapsed = currentSec - startSec;
        const nextItem = schedule[i + 1] || null;
        return {
          mode: "lesson",
          title: `Идёт ${item.lesson}-й урок (${item.start} – ${item.end})`,
          subtitle: nextItem
            ? `Перемена ${item.breakAfterMin} мин в ${item.end}, далее ${nextItem.lesson}-й урок`
            : `Окончание учебного дня в ${item.end}`,
          secondsLeft: endSec - currentSec,
          progress: Math.min(100, Math.round((elapsed / total) * 100)),
          currentLesson: item.lesson,
          nextLesson: nextItem ? nextItem.lesson : null
        };
      }

      if (i < schedule.length - 1) {
        const nextItem = schedule[i + 1];
        const nextStartSec = timeToMinutes(nextItem.start) * 60;
        if (currentSec >= endSec && currentSec < nextStartSec) {
          const total = nextStartSec - endSec;
          const elapsed = currentSec - endSec;
          return {
            mode: "break",
            title: `Перемена после ${item.lesson}-го урока (${item.breakAfterMin} мин)`,
            subtitle: `Следующий: ${nextItem.lesson}-й урок в ${nextItem.start}`,
            secondsLeft: nextStartSec - currentSec,
            progress: Math.min(100, Math.round((elapsed / total) * 100)),
            currentLesson: null,
            nextLesson: nextItem.lesson
          };
        }
      }
    }

    return {
      mode: "idle",
      title: "Вне сетки звонков",
      subtitle: "",
      secondsLeft: 0,
      progress: 0,
      currentLesson: null,
      nextLesson: null
    };
  }

  function initHomePage() {
    const statusEl = document.getElementById("homeStatusText");
    if (!statusEl) return;

    function updateRibbon() {
      const now = new Date();
      const state = getScheduleState(now);
      const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      if (state.mode === "lesson" || state.mode === "break" || state.mode === "before") {
        statusEl.textContent = `${timeStr} · ${state.title} · До звонка ${formatSeconds(state.secondsLeft)}`;
      } else {
        statusEl.textContent = `${timeStr} · ${state.title}`;
      }
    }

    updateRibbon();
    setInterval(updateRibbon, 1000);
  }

  function initTeachersPage() {
    const searchInput = document.getElementById("teacherSearch");
    const subjectSelect = document.getElementById("subjectFilter");
    const roleSelect = document.getElementById("roleFilter");
    const resetBtn = document.getElementById("resetFiltersBtn");
    const emptyResetBtn = document.getElementById("emptyResetBtn");
    const listContainer = document.getElementById("teachersList");
    const countEl = document.getElementById("teachersCount");
    const emptyEl = document.getElementById("teachersEmptyState");
    const inspectorBody = document.getElementById("inspectorBody");

    if (!listContainer) return;

    let selectedId = null;

    const subjectsSet = new Set();
    DATA.staff.forEach((person) => {
      person.subjects.forEach((subj) => subjectsSet.add(subj));
    });
    Array.from(subjectsSet)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .forEach((subj) => {
        const opt = document.createElement("option");
        opt.value = subj;
        opt.textContent = subj;
        subjectSelect.appendChild(opt);
      });

    const categories = Array.from(new Set(DATA.staff.map((p) => p.category)));
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      roleSelect.appendChild(opt);
    });

    function renderInspector(person) {
      if (!person) return;
      selectedId = person.id;

      const roomLinks = person.rooms.length
        ? person.rooms
            .map(
              (room) =>
                `<a href="./map.html?room=${encodeURIComponent(room)}&teacher=${encodeURIComponent(person.fullName)}" class="pill-btn pill-btn-dark">Показать «${room}» на карте</a>`
            )
            .join("")
        : `<p class="detail-muted">Номер кабинета не указан в реестре.</p>`;

      inspectorBody.innerHTML = `
        <p class="detail-eyebrow">Сотрудник №${String(person.id).padStart(2, "0")}</p>
        <h2 class="detail-title">${person.fullName}</h2>
        <div class="detail-specs">
          <div class="spec-block">
            <span>Предмет / должность</span>
            <strong>${person.role}</strong>
          </div>
          <div class="spec-block">
            <span>Категория</span>
            <strong>${person.category}</strong>
          </div>
          <div class="spec-block">
            <span>Кабинет / место работы</span>
            <strong>${person.roomDisplay}</strong>
          </div>
        </div>
        <div class="detail-cta-stack">
          ${roomLinks}
        </div>
      `;
    }

    function renderList() {
      const query = searchInput.value.trim().toLowerCase();
      const subjFilter = subjectSelect.value;
      const roleFilter = roleSelect.value;

      const filtered = DATA.staff.filter((person) => {
        const matchesQuery =
          !query ||
          person.fullName.toLowerCase().includes(query) ||
          person.role.toLowerCase().includes(query) ||
          person.roomDisplay.toLowerCase().includes(query);

        const matchesSubject =
          subjFilter === "all" || person.subjects.includes(subjFilter);

        const matchesRole =
          roleFilter === "all" || person.category === roleFilter;

        return matchesQuery && matchesSubject && matchesRole;
      });

      countEl.textContent = `Показано: ${filtered.length} из ${DATA.staff.length}`;

      if (filtered.length === 0) {
        listContainer.hidden = true;
        emptyEl.hidden = false;
        listContainer.innerHTML = "";
        return;
      }

      listContainer.hidden = false;
      emptyEl.hidden = true;

      listContainer.innerHTML = filtered
        .map((person) => {
          const isSelected = person.id === selectedId ? "is-selected" : "";
          const hasRoom = person.rooms.length > 0;
          const roomClass = hasRoom ? "dir-room" : "dir-room is-empty";
          const actionHtml = hasRoom
            ? `<a href="./map.html?room=${encodeURIComponent(person.rooms[0])}&teacher=${encodeURIComponent(person.fullName)}" class="dir-link" onclick="event.stopPropagation()">На карте ›</a>`
            : `<span class="dir-room is-empty" style="text-align:right">—</span>`;

          return `
            <div class="directory-item ${isSelected}" role="listitem" data-id="${person.id}">
              <div class="dir-name">${person.fullName}</div>
              <div class="dir-role">${person.role}</div>
              <div class="${roomClass}">${person.roomDisplay}</div>
              ${actionHtml}
            </div>
          `;
        })
        .join("");

      listContainer.querySelectorAll(".directory-item").forEach((row) => {
        row.addEventListener("click", () => {
          const id = Number(row.dataset.id);
          const person = DATA.staff.find((item) => item.id === id);
          if (person) {
            renderInspector(person);
            renderList();
          }
        });
      });
    }

    function resetAll() {
      searchInput.value = "";
      subjectSelect.value = "all";
      roleSelect.value = "all";
      renderList();
    }

    searchInput.addEventListener("input", renderList);
    subjectSelect.addEventListener("change", renderList);
    roleSelect.addEventListener("change", renderList);
    resetBtn.addEventListener("click", resetAll);
    if (emptyResetBtn) emptyResetBtn.addEventListener("click", resetAll);

    renderList();
  }

  function initMapPage() {
    const canvas = document.getElementById("floorPlanCanvas");
    if (!canvas) return;

    const floorBtns = document.querySelectorAll(".segment-btn[data-floor]");
    const floorCodeLabel = document.getElementById("floorCodeLabel");
    const floorTitleLabel = document.getElementById("floorTitleLabel");
    const roomInspectorBody = document.getElementById("roomInspectorBody");
    const searchInput = document.getElementById("mapSearchInput");
    const searchBtn = document.getElementById("mapSearchBtn");
    const resetBtn = document.getElementById("mapResetBtn");
    const feedbackEl = document.getElementById("mapFeedback");
    const unassignedContainer = document.getElementById("unassignedStaffList");

    let activeFloor = 1;
    let highlightedRoomId = null;

    if (unassignedContainer) {
      const unassigned = DATA.staff.filter((p) => p.rooms.length === 0);
      unassignedContainer.innerHTML = unassigned
        .map((p) => `<span class="unassigned-pill"><strong>${p.fullName}</strong> · ${p.role}</span>`)
        .join("");
    }

    function findFloorByRoomId(roomId) {
      const target = String(roomId).trim().toLowerCase();
      for (const [floorNum, floorData] of Object.entries(DATA.floors)) {
        const allRooms = [...floorData.northWing, ...floorData.southWing];
        const match = allRooms.find(
          (r) =>
            r.id.toLowerCase() === target ||
            r.label.toLowerCase().includes(target)
        );
        if (match) {
          return { floor: Number(floorNum), room: match };
        }
      }
      return null;
    }

    function renderRoomDetails(roomObj, floorNum, teacherHint) {
      const staffInRoom = DATA.staff.filter((person) =>
        person.rooms.some((r) => r.toLowerCase() === roomObj.id.toLowerCase())
      );

      const staffHtml = staffInRoom.length
        ? `<ul class="assigned-staff-list">
            ${staffInRoom
              .map(
                (p) => `
              <li class="assigned-staff-card">
                <strong>${p.fullName}</strong>
                <span>${p.role} (${p.roomDisplay})</span>
              </li>`
              )
              .join("")}
          </ul>`
        : `<p class="detail-muted">В реестре за этим помещением не закреплены конкретные преподаватели.</p>`;

      const hintHtml = teacherHint
        ? `<p class="map-toast" style="margin:12px 0;">Переход из справочника: <strong>${teacherHint}</strong></p>`
        : "";

      roomInspectorBody.innerHTML = `
        <p class="detail-eyebrow">${floorNum} этаж · Помещение</p>
        <h3 class="detail-title">${roomObj.label}</h3>
        <p class="detail-muted">${roomObj.title}</p>
        ${hintHtml}
        <div class="quick-jump-group">
          <span class="detail-eyebrow">Закреплённые сотрудники (${staffInRoom.length})</span>
          ${staffHtml}
        </div>
      `;
    }

    function renderFloor() {
      const floorData = DATA.floors[activeFloor];
      if (!floorData) return;

      floorCodeLabel.textContent = floorData.code;
      floorTitleLabel.textContent = floorData.title;

      floorBtns.forEach((btn) => {
        const isCurrent = Number(btn.dataset.floor) === activeFloor;
        btn.classList.toggle("is-active", isCurrent);
        btn.setAttribute("aria-selected", String(isCurrent));
      });

      function buildTile(room) {
        const isHighlighted =
          highlightedRoomId &&
          room.id.toLowerCase() === highlightedRoomId.toLowerCase();
        const staffCount = DATA.staff.filter((p) =>
          p.rooms.some((r) => r.toLowerCase() === room.id.toLowerCase())
        ).length;

        const classes = [
          "room-node",
          room.type === "infra" ? "is-infra" : "",
          isHighlighted ? "is-highlighted" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return `
          <button type="button" class="${classes}" data-room-id="${room.id}">
            <span class="room-node-num">${room.label}</span>
            <span class="room-node-desc">${room.title}${staffCount ? ` · ${staffCount}` : ""}</span>
          </button>
        `;
      }

      canvas.innerHTML = `
        <div class="wing-grid" aria-label="Верхнее крыло">
          ${floorData.northWing.map(buildTile).join("")}
        </div>
        <div class="corridor-strip">
          <span>Лестница А</span>
          <span>${floorData.corridorLabel}</span>
          <span>Лестница Б</span>
        </div>
        <div class="wing-grid" aria-label="Нижнее крыло">
          ${floorData.southWing.map(buildTile).join("")}
        </div>
      `;

      canvas.querySelectorAll(".room-node").forEach((tile) => {
        tile.addEventListener("click", () => {
          const id = tile.dataset.roomId;
          highlightedRoomId = id;
          const found = findFloorByRoomId(id);
          renderFloor();
          if (found) {
            renderRoomDetails(found.room, found.floor);
          }
        });
      });
    }

    function executeMapSearch(rawQuery, teacherHint) {
      const q = rawQuery.trim();
      if (!q) {
        feedbackEl.hidden = false;
        feedbackEl.textContent = "Введите номер кабинета (например, 307) или фамилию учителя.";
        return;
      }

      const roomMatch = findFloorByRoomId(q);
      if (roomMatch) {
        activeFloor = roomMatch.floor;
        highlightedRoomId = roomMatch.room.id;
        renderFloor();
        renderRoomDetails(roomMatch.room, roomMatch.floor, teacherHint);
        feedbackEl.hidden = false;
        feedbackEl.textContent = `Найдено: ${roomMatch.room.label} (${roomMatch.floor} этаж).`;
        return;
      }

      const teacherMatch = DATA.staff.find((p) =>
        p.fullName.toLowerCase().includes(q.toLowerCase())
      );

      if (teacherMatch) {
        if (teacherMatch.rooms.length > 0) {
          const firstRoom = teacherMatch.rooms[0];
          const found = findFloorByRoomId(firstRoom);
          if (found) {
            activeFloor = found.floor;
            highlightedRoomId = found.room.id;
            renderFloor();
            renderRoomDetails(found.room, found.floor, teacherMatch.fullName);
            feedbackEl.hidden = false;
            feedbackEl.textContent = `${teacherMatch.fullName} — ${teacherMatch.roomDisplay} (${found.floor} этаж).`;
            return;
          }
        } else {
          feedbackEl.hidden = false;
          feedbackEl.textContent = `${teacherMatch.fullName} (${teacherMatch.role}): кабинет в документе указан как «Не указан».`;
          return;
        }
      }

      feedbackEl.hidden = false;
      feedbackEl.textContent = `По запросу «${q}» помещение или сотрудник не найдены.`;
    }

    floorBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFloor = Number(btn.dataset.floor);
        renderFloor();
      });
    });

    searchBtn.addEventListener("click", () => executeMapSearch(searchInput.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeMapSearch(searchInput.value);
      }
    });

    resetBtn.addEventListener("click", () => {
      highlightedRoomId = null;
      searchInput.value = "";
      feedbackEl.hidden = true;
      renderFloor();
    });

    document.querySelectorAll("[data-jump-room]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const room = btn.dataset.jumpRoom;
        searchInput.value = room;
        executeMapSearch(room);
      });
    });

    const params = new URLSearchParams(window.location.search);
    const paramRoom = params.get("room");
    const paramTeacher = params.get("teacher");

    renderFloor();

    if (paramRoom) {
      searchInput.value = paramRoom;
      executeMapSearch(paramRoom, paramTeacher || undefined);
    }
  }

  function initSchedulePage() {
    const tbody = document.getElementById("bellsTableBody");
    if (!tbody) return;

    const liveClockEl = document.getElementById("liveClock");
    const liveDateEl = document.getElementById("liveDate");
    const periodBadgeEl = document.getElementById("periodBadge");
    const currentTitleEl = document.getElementById("currentPeriodTitle");
    const nextInfoEl = document.getElementById("nextPeriodInfo");
    const countdownEl = document.getElementById("bellCountdown");
    const progressFillEl = document.getElementById("periodProgressFill");

    const variantBtns = document.querySelectorAll(".segment-btn[data-variant]");
    const fridayPanel = document.getElementById("variantFridayPanel");
    const regularPanel = document.getElementById("variantRegularPanel");

    variantBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const variant = btn.dataset.variant;
        variantBtns.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        fridayPanel.hidden = variant !== "friday";
        regularPanel.hidden = variant !== "regular";
      });
    });

    function renderSchedule() {
      const now = new Date();
      const state = getScheduleState(now);

      liveClockEl.textContent = now.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      liveDateEl.textContent = now.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      const badgeLabels = {
        lesson: "Идёт урок",
        break: "Перемена",
        before: "До начала занятий",
        after: "Занятия окончены",
        idle: "Расписание"
      };

      periodBadgeEl.textContent = badgeLabels[state.mode] || "Статус";
      currentTitleEl.textContent = state.title;
      nextInfoEl.textContent = state.subtitle;
      countdownEl.textContent =
        state.mode === "after" ? "00:00" : formatSeconds(state.secondsLeft);
      progressFillEl.style.width = `${state.progress}%`;

      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      tbody.innerHTML = DATA.bellScheduleFriday
        .map((item) => {
          const isCurrent = state.currentLesson === item.lesson;
          const isNext = state.nextLesson === item.lesson;
          const isDone = nowMinutes >= timeToMinutes(item.end);

          let rowClass = "lesson-row";
          let pill = `<span class="badge-pill">По расписанию</span>`;

          if (isCurrent) {
            rowClass += " is-current-lesson";
            pill = `<span class="badge-pill is-now">Идёт сейчас</span>`;
          } else if (isNext) {
            rowClass += " is-next-lesson";
            pill = `<span class="badge-pill is-next">Следующий</span>`;
          } else if (isDone) {
            pill = `<span class="badge-pill">Завершён</span>`;
          }

          const breakRow =
            item.breakAfterMin > 0
              ? `<tr class="break-row">
                  <td colspan="6">Перемена после ${item.lesson}-го урока · ${item.breakAfterMin} мин</td>
                </tr>`
              : "";

          return `
            <tr class="${rowClass}">
              <td><strong>${item.lesson} урок</strong></td>
              <td>${item.start}</td>
              <td>${item.end}</td>
              <td>${item.durationMin} мин</td>
              <td>${item.breakAfterMin > 0 ? item.breakAfterMin + " мин" : "—"}</td>
              <td>${pill}</td>
            </tr>
            ${breakRow}
          `;
        })
        .join("");
    }

    renderSchedule();
    setInterval(renderSchedule, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initScrollReveal();
    const page = document.body.dataset.page;
    if (page === "home") initHomePage();
    if (page === "teachers") initTeachersPage();
    if (page === "map") initMapPage();
    if (page === "schedule") initSchedulePage();
  });
})();