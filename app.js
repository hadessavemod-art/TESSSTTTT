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
        title: "Учебные занятия завершены",
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
            ? `Перемена ${item.breakAfterMin} мин начнётся в ${item.end}, далее ${nextItem.lesson}-й урок`
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
        statusEl.textContent = `${timeStr} · ${state.title} · До звонка: ${formatSeconds(state.secondsLeft)}`;
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
    const tbody = document.getElementById("teachersTableBody");
    const countEl = document.getElementById("teachersCount");
    const emptyEl = document.getElementById("teachersEmptyState");
    const tableEl = document.getElementById("staffTable");
    const inspectorBody = document.getElementById("inspectorBody");

    if (!tbody) return;

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
                `<a href="./map.html?room=${encodeURIComponent(room)}&teacher=${encodeURIComponent(person.fullName)}" class="btn btn-primary">Показать «${room}» на карте →</a>`
            )
            .join("")
        : `<span class="room-pill is-unknown">Кабинет в документе не указан</span>`;

      inspectorBody.innerHTML = `
        <h2 class="inspector-name">${person.fullName}</h2>
        <div class="inspector-meta">
          <div class="inspector-row">
            <span>Должность / предмет</span>
            <strong>${person.role}</strong>
          </div>
          <div class="inspector-row">
            <span>Категория</span>
            <div>${person.category}</div>
          </div>
          <div class="inspector-row">
            <span>Кабинет / место работы</span>
            <div><strong>${person.roomDisplay}</strong></div>
          </div>
        </div>
        <div class="inspector-actions">
          ${roomLinks}
        </div>
      `;
    }

    function renderTable() {
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

      countEl.textContent = `Найдено сотрудников: ${filtered.length} из ${DATA.staff.length}`;

      if (filtered.length === 0) {
        tableEl.hidden = true;
        emptyEl.hidden = false;
        tbody.innerHTML = "";
        return;
      }

      tableEl.hidden = false;
      emptyEl.hidden = true;

      tbody.innerHTML = filtered
        .map((person) => {
          const isSelected = person.id === selectedId ? "is-selected" : "";
          const hasRoom = person.rooms.length > 0;
          const roomBadge = hasRoom
            ? `<span class="room-pill">${person.roomDisplay}</span>`
            : `<span class="room-pill is-unknown">Не указан</span>`;

          const navAction = hasRoom
            ? `<a href="./map.html?room=${encodeURIComponent(person.rooms[0])}&teacher=${encodeURIComponent(person.fullName)}" class="map-jump-link" onclick="event.stopPropagation()">На карте →</a>`
            : `<span class="mono-tag">—</span>`;

          return `
            <tr data-id="${person.id}" class="${isSelected}">
              <td class="col-num">${String(person.id).padStart(2, "0")}</td>
              <td class="col-name">${person.fullName}</td>
              <td class="col-role">${person.role}</td>
              <td class="col-room">${roomBadge}</td>
              <td class="col-action">${navAction}</td>
            </tr>
          `;
        })
        .join("");

      tbody.querySelectorAll("tr").forEach((row) => {
        row.addEventListener("click", () => {
          const id = Number(row.dataset.id);
          const person = DATA.staff.find((item) => item.id === id);
          if (person) {
            renderInspector(person);
            renderTable();
          }
        });
      });
    }

    function resetAll() {
      searchInput.value = "";
      subjectSelect.value = "all";
      roleSelect.value = "all";
      renderTable();
    }

    searchInput.addEventListener("input", renderTable);
    subjectSelect.addEventListener("change", renderTable);
    roleSelect.addEventListener("change", renderTable);
    resetBtn.addEventListener("click", resetAll);
    if (emptyResetBtn) emptyResetBtn.addEventListener("click", resetAll);

    renderTable();
  }

  function initMapPage() {
    const canvas = document.getElementById("floorPlanCanvas");
    if (!canvas) return;

    const floorBtns = document.querySelectorAll(".floor-btn");
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
        .map((p) => `<span class="staff-tag"><strong>${p.fullName}</strong> — ${p.role}</span>`)
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
        ? `<ul class="room-staff-list">
            ${staffInRoom
              .map(
                (p) => `
              <li class="room-staff-item">
                <strong>${p.fullName}</strong>
                <span>${p.role} (каб. ${p.roomDisplay})</span>
              </li>`
              )
              .join("")}
          </ul>`
        : `<p>В списке сотрудников за этим помещением не закреплены конкретные преподаватели.</p>`;

      const hintHtml = teacherHint
        ? `<div class="map-feedback" style="margin-top:12px;">Переход из справочника: <strong>${teacherHint}</strong></div>`
        : "";

      roomInspectorBody.innerHTML = `
        <span class="mono-tag">${floorNum} ЭТАЖ · СХЕМА</span>
        <h3>${roomObj.label}</h3>
        <p>${roomObj.title}</p>
        ${hintHtml}
        <span class="field-label">Закреплённые сотрудники (${staffInRoom.length}):</span>
        ${staffHtml}
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
          "room-tile",
          room.type === "infra" ? "is-infra" : "",
          isHighlighted ? "is-highlighted" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return `
          <button type="button" class="${classes}" data-room-id="${room.id}">
            <span class="room-tile-code">${room.label}</span>
            <span class="room-tile-sub">${room.title}${staffCount ? ` · Сотр.: ${staffCount}` : ""}</span>
          </button>
        `;
      }

      canvas.innerHTML = `
        <div class="plan-wing" aria-label="Верхнее крыло">
          ${floorData.northWing.map(buildTile).join("")}
        </div>
        <div class="plan-corridor">
          <span>← ЛЕСТНИЦА А</span>
          <span>${floorData.corridorLabel}</span>
          <span>ЛЕСТНИЦА Б →</span>
        </div>
        <div class="plan-wing" aria-label="Нижнее крыло">
          ${floorData.southWing.map(buildTile).join("")}
        </div>
      `;

      canvas.querySelectorAll(".room-tile").forEach((tile) => {
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
        feedbackEl.textContent = `Найдено помещение: ${roomMatch.room.label} (${roomMatch.floor} этаж).`;
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
            feedbackEl.textContent = `${teacherMatch.fullName} — кабинет ${teacherMatch.roomDisplay} (${found.floor} этаж).`;
            return;
          }
        } else {
          feedbackEl.hidden = false;
          feedbackEl.textContent = `${teacherMatch.fullName} (${teacherMatch.role}): в документе школы кабинет обозначен как «Не указан».`;
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

    const variantBtns = document.querySelectorAll(".variant-btn");
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
        lesson: "ИДЁТ УРОК",
        break: "ПЕРЕМЕНА",
        before: "ДО НАЧАЛА ЗАНЯТИЙ",
        after: "ЗАНЯТИЯ ОКОНЧЕНЫ",
        idle: "РАСПИСАНИЕ"
      };

      periodBadgeEl.textContent = badgeLabels[state.mode] || "СТАТУС";
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

          let rowClass = "row-lesson";
          let pill = `<span class="state-pill">По расписанию</span>`;

          if (isCurrent) {
            rowClass += " is-current-lesson";
            pill = `<span class="state-pill now">Идёт сейчас</span>`;
          } else if (isNext) {
            rowClass += " is-next-lesson";
            pill = `<span class="state-pill next">Следующий</span>`;
          } else if (isDone) {
            pill = `<span class="state-pill done">Завершён</span>`;
          }

          const breakRow =
            item.breakAfterMin > 0
              ? `<tr class="row-break">
                  <td colspan="6">Перемена после ${item.lesson}-го урока — <strong>${item.breakAfterMin} мин</strong></td>
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
    const page = document.body.dataset.page;
    if (page === "home") initHomePage();
    if (page === "teachers") initTeachersPage();
    if (page === "map") initMapPage();
    if (page === "schedule") initSchedulePage();
  });
})();