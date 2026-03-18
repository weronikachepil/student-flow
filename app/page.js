"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

const DAY_ORDER = [
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "П'ятниця",
  "Субота",
];

const STATUS_META = {
  todo: {
    title: "Треба зробити",
    description: "Усе, що ще чекає старту.",
  },
  inprogress: {
    title: "В процесі",
    description: "Те, над чим зараз іде робота.",
  },
  done: {
    title: "Готово",
    description: "Усе завершене і відмічене.",
  },
};

const PRIORITY_LABELS = {
  high: "Високий",
  medium: "Середній",
  low: "Низький",
};

const RESOURCE_TYPE_LABELS = {
  drive: "Google Drive",
  zoom: "Zoom",
  moodle: "Moodle",
  telegram: "Telegram",
  notes: "Конспекти",
  other: "Інше",
};

const emptyData = {
  profiles: [],
  groupTasks: [],
  personalTasks: [],
  announcements: [],
  resources: [],
  scheduleEntries: [],
};

function sortByDeadline(items) {
  return [...items].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

function TaskCard({ task, canEdit, onToggleComplete, onStatusChange, onDelete, assigneeLabel }) {
  return (
    <article className={`task-item ${task.status === "done" ? "is-completed" : ""}`}>
      <div className="task-item__checkline">
        <label className="task-checkbox">
          <input
            checked={task.status === "done"}
            disabled={!canEdit}
            onChange={(event) => onToggleComplete(task, event.target.checked)}
            type="checkbox"
          />
          <span />
        </label>
        <div className="task-item__main">
          <div className="task-item__topline">
            <h3>{task.title}</h3>
            <span className="priority-pill" data-priority={task.priority}>
              {PRIORITY_LABELS[task.priority] || "Середній"}
            </span>
          </div>
          <p className="task-item__meta">
            {task.subject} • {formatDeadline(task.deadline)}
            {assigneeLabel ? ` • ${assigneeLabel}` : ""}
          </p>
          <p className="task-item__details">{task.details || "Без додаткового опису."}</p>
        </div>
      </div>
      <div className="task-item__actions">
        <select
          className="task-status-select"
          disabled={!canEdit}
          onChange={(event) => onStatusChange(task, event.target.value)}
          value={task.status}
        >
          <option value="todo">Треба зробити</option>
          <option value="inprogress">В процесі</option>
          <option value="done">Готово</option>
        </select>
        {onDelete ? (
          <button className="button button--ghost button--danger" onClick={() => onDelete(task)} type="button">
            Видалити
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TaskBoard({ tasks, canEditTask, onToggleComplete, onStatusChange, onDelete, getAssigneeLabel }) {
  return (
    <div className="task-board">
      {Object.entries(STATUS_META).map(([status, meta]) => {
        const statusTasks = tasks.filter((task) => task.status === status);

        return (
          <section className="task-column" key={status}>
            <div className="task-column__header">
              <div>
                <h3>{meta.title}</h3>
                <p>{meta.description}</p>
              </div>
              <span className="task-column__count">{statusTasks.length}</span>
            </div>
            <div className="task-column__items">
              {statusTasks.length ? (
                statusTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    assigneeLabel={getAssigneeLabel ? getAssigneeLabel(task) : ""}
                    canEdit={canEditTask(task)}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    onToggleComplete={onToggleComplete}
                    task={task}
                  />
                ))
              ) : (
                <div className="empty-state">Поки пусто</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [supabase] = useState(() => getSupabaseClient());
  const [theme, setTheme] = useState("light");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [taskFilter, setTaskFilter] = useState("all");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("student-flow-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem("student-flow-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(async ({ data: authData }) => {
      const activeSession = authData.session;
      setSession(activeSession);
      if (activeSession?.user) {
        await loadAll(activeSession.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await loadAll(nextSession.user.id);
      } else {
        setProfile(null);
        setData(emptyData);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function loadAll(userId) {
    if (!supabase) return;

    setLoading(true);

    const [profilesRes, groupTasksRes, personalTasksRes, announcementsRes, resourcesRes, scheduleRes] =
      await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("group_tasks").select("*").order("deadline", { ascending: true }),
        supabase.from("personal_tasks").select("*").order("deadline", { ascending: true }),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }),
        supabase.from("resources").select("*").order("created_at", { ascending: false }),
        supabase.from("schedule_entries").select("*").order("day_of_week", { ascending: true }).order("time_start", { ascending: true }),
      ]);

    const firstError = [
      profilesRes.error,
      groupTasksRes.error,
      personalTasksRes.error,
      announcementsRes.error,
      resourcesRes.error,
      scheduleRes.error,
    ].find(Boolean);

    if (firstError) {
      setFeedback(firstError.message, true);
      setLoading(false);
      return;
    }

    const nextProfiles = profilesRes.data || [];
    setProfile(nextProfiles.find((item) => item.id === userId) || null);
    setData({
      profiles: nextProfiles,
      groupTasks: groupTasksRes.data || [],
      personalTasks: personalTasksRes.data || [],
      announcements: announcementsRes.data || [],
      resources: resourcesRes.data || [],
      scheduleEntries: scheduleRes.data || [],
    });
    setLoading(false);
  }

  function setFeedback(text, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabase) return;
    const form = event.currentTarget;

    const formData = new FormData(form);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password")).trim();
    const fullName = String(formData.get("fullName") || "").trim();

    setBusy(true);
    setFeedback("");

    if (authMode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setFeedback(error.message, true);
      } else {
        setFeedback("Реєстрація пройшла. Якщо в Supabase увімкнено email confirmation, підтвердь пошту.");
        form.reset();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setFeedback(error.message, true);
      } else {
        setFeedback("Вхід успішний.");
        form.reset();
      }
    }

    setBusy(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function withRefresh(action, successText) {
    if (!supabase || !session?.user) return;

    setBusy(true);
    setFeedback("");
    const result = await action();

    if (result?.error) {
      setFeedback(result.error.message, true);
      setBusy(false);
      return;
    }

    await loadAll(session.user.id);
    setBusy(false);
    if (successText) {
      setFeedback(successText);
    }
  }

  async function createGroupTask(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const assignee = String(formData.get("assignee"));

    await withRefresh(
      () =>
        supabase.from("group_tasks").insert({
          title: String(formData.get("title")).trim(),
          subject: String(formData.get("subject")).trim(),
          deadline: String(formData.get("deadline")),
          priority: String(formData.get("priority")),
          status: String(formData.get("status")),
          details: String(formData.get("details")).trim(),
          is_for_all: assignee === "all",
          assignee_id: assignee === "all" ? null : assignee,
          created_by: session.user.id,
        }),
      "Групове завдання додано."
    );

    form.reset();
  }

  async function createPersonalTask(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await withRefresh(
      () =>
        supabase.from("personal_tasks").insert({
          title: String(formData.get("title")).trim(),
          deadline: String(formData.get("deadline")),
          priority: String(formData.get("priority")),
          status: String(formData.get("status")),
          details: String(formData.get("details")).trim(),
          owner_id: session.user.id,
        }),
      "Особисте завдання додано."
    );

    form.reset();
  }

  async function createAnnouncement(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await withRefresh(
      () =>
        supabase.from("announcements").insert({
          title: String(formData.get("title")).trim(),
          content: String(formData.get("content")).trim(),
          created_by: session.user.id,
        }),
      "Оголошення опубліковано."
    );

    form.reset();
  }

  async function createResource(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await withRefresh(
      () =>
        supabase.from("resources").insert({
          title: String(formData.get("title")).trim(),
          type: String(formData.get("type")),
          url: String(formData.get("url")).trim(),
          created_by: session.user.id,
        }),
      "Посилання додано."
    );

    form.reset();
  }

  async function createScheduleEntry(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await withRefresh(
      () =>
        supabase.from("schedule_entries").insert({
          day_of_week: String(formData.get("day_of_week")),
          time_start: String(formData.get("time_start")),
          subject: String(formData.get("subject")).trim(),
          room: String(formData.get("room")).trim(),
          created_by: session.user.id,
        }),
      "Пару додано в розклад."
    );

    form.reset();
  }

  async function updateGroupTask(task, patch) {
    await withRefresh(
      () => supabase.from("group_tasks").update(patch).eq("id", task.id),
      "Групове завдання оновлено."
    );
  }

  async function updatePersonalTask(task, patch) {
    await withRefresh(
      () => supabase.from("personal_tasks").update(patch).eq("id", task.id),
      "Особисте завдання оновлено."
    );
  }

  async function deleteGroupTask(task) {
    await withRefresh(() => supabase.from("group_tasks").delete().eq("id", task.id), "Групове завдання видалено.");
  }

  async function deletePersonalTask(task) {
    await withRefresh(() => supabase.from("personal_tasks").delete().eq("id", task.id), "Особисте завдання видалено.");
  }

  const isAdmin = profile?.role === "admin";

  const students = useMemo(
    () => data.profiles.filter((item) => item.role === "student"),
    [data.profiles]
  );

  const visibleGroupTasks = useMemo(() => {
    if (!profile) return [];
    if (isAdmin) return sortByDeadline(data.groupTasks);

    return sortByDeadline(
      data.groupTasks.filter((task) => task.is_for_all || task.assignee_id === profile.id)
    );
  }, [data.groupTasks, isAdmin, profile]);

  const filteredGroupTasks = useMemo(() => {
    return visibleGroupTasks.filter((task) => {
      if (taskFilter === "completed") return task.status === "done";
      if (taskFilter === "active") return task.status !== "done";
      if (taskFilter === "urgent") return task.status !== "done" && daysUntil(task.deadline) <= 7;
      if (taskFilter === "mine") return !task.is_for_all;
      return true;
    });
  }, [taskFilter, visibleGroupTasks]);

  const personalTasks = useMemo(() => {
    if (!profile) return [];
    return sortByDeadline(data.personalTasks.filter((task) => task.owner_id === profile.id));
  }, [data.personalTasks, profile]);

  const stats = useMemo(() => {
    const allVisibleTasks = [...visibleGroupTasks, ...personalTasks];
    const total = allVisibleTasks.length;
    const urgent = allVisibleTasks.filter((task) => task.status !== "done" && daysUntil(task.deadline) <= 7).length;
    const completed = allVisibleTasks.filter((task) => task.status === "done").length;
    return {
      total,
      urgent,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [personalTasks, visibleGroupTasks]);

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("uk-UA", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
  }, []);

  const todaySchedule = useMemo(() => {
    const dayName = capitalize(
      new Intl.DateTimeFormat("uk-UA", { weekday: "long" }).format(new Date())
    );
    return data.scheduleEntries.filter((entry) => entry.day_of_week === dayName);
  }, [data.scheduleEntries]);

  const groupedSchedule = useMemo(() => {
    return DAY_ORDER.map((day) => ({
      day,
      items: data.scheduleEntries.filter((entry) => entry.day_of_week === day),
    }));
  }, [data.scheduleEntries]);

  function canEditGroupTask(task) {
    if (!profile) return false;
    if (isAdmin) return true;
    return task.is_for_all || task.assignee_id === profile.id;
  }

  function assigneeLabel(task) {
    if (task.is_for_all) return "Для всієї групи";
    const person = data.profiles.find((item) => item.id === task.assignee_id);
    return person ? `Для ${person.full_name}` : "Призначено";
  }

  if (!supabase) {
    return (
      <main className="page-shell">
        <section className="card">
          <h1>Потрібно підключити Supabase</h1>
          <p>
            У `.env.local` мають бути справжні `NEXT_PUBLIC_SUPABASE_URL` і
            `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      {!session ? (
        <section className="auth-layout">
          <header className="hero">
            <div className="hero__content">
              <p className="eyebrow">Student Flow</p>
              <h1>Простір групи, де староста керує процесом, а студенти бачать усе онлайн</h1>
              <p className="hero__text">
                Після налаштування Supabase цим вже можна користуватись як реальним
                сайтом: реєстрація, вхід, ролі, задачі, оголошення, посилання і розклад.
              </p>
            </div>
            <aside className="hero__panel">
              <p className="hero__panel-label">Що вже працює</p>
              <ul className="today-list">
                <li>Реєстрація і вхід через Supabase Auth</li>
                <li>Ролі старости і студента</li>
                <li>Живі таблиці для задач, розкладу, оголошень і посилань</li>
              </ul>
            </aside>
          </header>

          <section className="auth-grid">
            <article className="card">
              <div className="card__header">
                <div>
                  <p className="section-tag">Доступ</p>
                  <h2>{authMode === "login" ? "Вхід" : "Реєстрація"}</h2>
                </div>
              </div>

              <form className="stack-form" onSubmit={handleAuthSubmit}>
                {authMode === "register" ? (
                  <label>
                    Ім'я
                    <input name="fullName" placeholder="Вероніка" required type="text" />
                  </label>
                ) : null}
                <label>
                  Email
                  <input name="email" placeholder="group@example.com" required type="email" />
                </label>
                <label>
                  Пароль
                  <input name="password" placeholder="Мінімум 6 символів" required type="password" />
                </label>
                <button className="button button--primary" disabled={busy} type="submit">
                  {busy ? "Завантаження..." : authMode === "login" ? "Увійти" : "Зареєструватися"}
                </button>
              </form>

              <button
                className="button button--ghost switch-button"
                onClick={() => setAuthMode((current) => (current === "login" ? "register" : "login"))}
                type="button"
              >
                {authMode === "login" ? "Створити акаунт" : "У мене вже є акаунт"}
              </button>
            </article>
          </section>
          {message ? <p className={`message ${isError ? "is-error" : "is-success"}`}>{message}</p> : null}
        </section>
      ) : (
        <section className="app-view">
          <header className="hero">
            <div className="hero__content">
              <div className="topbar">
                <p className="eyebrow">Student Flow</p>
                <div className="topbar__actions">
                  <button
                    className="button button--ghost"
                    onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                    type="button"
                  >
                    {theme === "dark" ? "Світла тема" : "Темна тема"}
                  </button>
                  <div className="user-badge">
                    <span>{profile?.full_name || session.user.email}</span>
                    <strong>{isAdmin ? "Староста" : "Студент"}</strong>
                    <button className="button button--ghost" onClick={handleLogout} type="button">
                      Вийти
                    </button>
                  </div>
                </div>
              </div>
              <h1>Студентський штаб для розкладу, дедлайнів, оголошень і особистого планування</h1>
              <p className="hero__text">
                {isAdmin
                  ? "Ти як староста можеш керувати всім груповим простором: задачами, розкладом, оголошеннями й важливими посиланнями."
                  : "Тут видно задачі для тебе і для всієї групи, розклад, оголошення від старости і твій особистий планер."}
              </p>
              <div className="hero__stats">
                <article>
                  <span>{stats.total}</span>
                  <p>Видимі задачі</p>
                </article>
                <article>
                  <span>{stats.urgent}</span>
                  <p>Горять цього тижня</p>
                </article>
                <article>
                  <span>{stats.progress}%</span>
                  <p>Прогрес виконання</p>
                </article>
              </div>
            </div>
            <aside className="hero__panel">
              <p className="hero__panel-label">Сьогодні</p>
              <h2>{capitalize(todayLabel)}</h2>
              <ul className="today-list">
                {todaySchedule.length ? (
                  todaySchedule.map((entry) => (
                    <li key={entry.id}>
                      <strong>
                        {entry.time_start} • {entry.subject}
                      </strong>
                      <span>{entry.room ? `Аудиторія ${entry.room}` : "Без аудиторії"}</span>
                    </li>
                  ))
                ) : (
                  <li>На сьогодні пар немає.</li>
                )}
              </ul>
            </aside>
          </header>

          {message ? <p className={`message ${isError ? "is-error" : "is-success"}`}>{message}</p> : null}

          {loading ? (
            <section className="card">
              <p>Завантажую дані...</p>
            </section>
          ) : (
            <section className="dashboard">
              {isAdmin ? (
                <section className="card card--wide">
                  <div className="card__header">
                    <div>
                      <p className="section-tag">Староста</p>
                      <h2>Нове групове завдання</h2>
                    </div>
                  </div>
                  <form className="grid-form" onSubmit={createGroupTask}>
                    <label>
                      Назва
                      <input name="title" placeholder="Напр. Лаба з фізики" required type="text" />
                    </label>
                    <label>
                      Предмет
                      <input name="subject" placeholder="Вища математика" required type="text" />
                    </label>
                    <label>
                      Дедлайн
                      <input name="deadline" required type="date" />
                    </label>
                    <label>
                      Пріоритет
                      <select defaultValue="medium" name="priority">
                        <option value="high">Високий</option>
                        <option value="medium">Середній</option>
                        <option value="low">Низький</option>
                      </select>
                    </label>
                    <label>
                      Кому
                      <select defaultValue="all" name="assignee">
                        <option value="all">Усій групі</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Статус
                      <select defaultValue="todo" name="status">
                        <option value="todo">Треба зробити</option>
                        <option value="inprogress">В процесі</option>
                        <option value="done">Готово</option>
                      </select>
                    </label>
                    <label className="grid-form__full">
                      Опис
                      <textarea name="details" placeholder="Що саме треба зробити?" rows="3" />
                    </label>
                    <button className="button button--primary" disabled={busy} type="submit">
                      Додати завдання
                    </button>
                  </form>
                </section>
              ) : null}

              {isAdmin ? (
                <section className="card">
                  <div className="card__header">
                    <div>
                      <p className="section-tag">Староста</p>
                      <h2>Нова пара</h2>
                    </div>
                  </div>
                  <form className="stack-form" onSubmit={createScheduleEntry}>
                    <label>
                      День
                      <select defaultValue="Понеділок" name="day_of_week">
                        {DAY_ORDER.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Час
                      <input name="time_start" required type="time" />
                    </label>
                    <label>
                      Предмет
                      <input name="subject" placeholder="Історія України" required type="text" />
                    </label>
                    <label>
                      Аудиторія
                      <input name="room" placeholder="215" type="text" />
                    </label>
                    <button className="button" disabled={busy} type="submit">
                      Додати в розклад
                    </button>
                  </form>
                </section>
              ) : null}

              {isAdmin ? (
                <section className="card">
                  <div className="card__header">
                    <div>
                      <p className="section-tag">Староста</p>
                      <h2>Нове оголошення</h2>
                    </div>
                  </div>
                  <form className="stack-form" onSubmit={createAnnouncement}>
                    <label>
                      Заголовок
                      <input name="title" placeholder="Заміна пари в п'ятницю" required type="text" />
                    </label>
                    <label>
                      Текст
                      <textarea name="content" placeholder="Що важливо знати групі?" required rows="4" />
                    </label>
                    <button className="button" disabled={busy} type="submit">
                      Опублікувати
                    </button>
                  </form>
                </section>
              ) : null}

              <section className="card">
                <div className="card__header">
                  <div>
                    <p className="section-tag">Група</p>
                    <h2>Оголошення</h2>
                  </div>
                </div>
                <div className="announcement-list">
                  {data.announcements.length ? (
                    data.announcements.map((item) => {
                      const author = data.profiles.find((profileItem) => profileItem.id === item.created_by);
                      return (
                        <article className="announcement-item" key={item.id}>
                          <h3>{item.title}</h3>
                          <p className="announcement-item__meta">
                            {formatDateTime(item.created_at)} • {author?.full_name || "Староста"}
                          </p>
                          <p>{item.content}</p>
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty-state">Поки немає оголошень.</div>
                  )}
                </div>
              </section>

              {isAdmin ? (
                <section className="card">
                  <div className="card__header">
                    <div>
                      <p className="section-tag">Староста</p>
                      <h2>Додати посилання</h2>
                    </div>
                  </div>
                  <form className="stack-form" onSubmit={createResource}>
                    <label>
                      Назва
                      <input name="title" placeholder="Google Drive групи" required type="text" />
                    </label>
                    <label>
                      Тип
                      <select defaultValue="drive" name="type">
                        {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Посилання
                      <input name="url" placeholder="https://..." required type="url" />
                    </label>
                    <button className="button" disabled={busy} type="submit">
                      Додати ресурс
                    </button>
                  </form>
                </section>
              ) : null}

              <section className="card">
                <div className="card__header">
                  <div>
                    <p className="section-tag">Група</p>
                    <h2>Корисні посилання</h2>
                  </div>
                </div>
                <div className="resource-list">
                  {data.resources.length ? (
                    data.resources.map((item) => (
                      <article className="resource-item" key={item.id}>
                        <h3>{item.title}</h3>
                        <p className="resource-item__meta">{RESOURCE_TYPE_LABELS[item.type] || "Ресурс"}</p>
                        <p>
                          <a href={item.url} rel="noreferrer" target="_blank">
                            {item.url}
                          </a>
                        </p>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">Поки немає доданих посилань.</div>
                  )}
                </div>
              </section>

              <section className="card card--wide">
                <div className="card__header">
                  <div>
                    <p className="section-tag">Групові задачі</p>
                    <h2>Task Board</h2>
                  </div>
                  <select onChange={(event) => setTaskFilter(event.target.value)} value={taskFilter}>
                    <option value="all">Усі</option>
                    <option value="urgent">Термінові</option>
                    <option value="completed">Виконані</option>
                    <option value="active">Активні</option>
                    <option value="mine">Призначені конкретно комусь</option>
                  </select>
                </div>
                <TaskBoard
                  canEditTask={canEditGroupTask}
                  getAssigneeLabel={assigneeLabel}
                  onDelete={isAdmin ? deleteGroupTask : null}
                  onStatusChange={(task, status) => updateGroupTask(task, { status })}
                  onToggleComplete={(task, checked) =>
                    updateGroupTask(task, { status: checked ? "done" : fallbackStatus(task.status) })
                  }
                  tasks={filteredGroupTasks}
                />
              </section>

              <section className="card card--wide">
                <div className="card__header">
                  <div>
                    <p className="section-tag">Особисте</p>
                    <h2>Мій планер</h2>
                  </div>
                </div>
                <form className="grid-form" onSubmit={createPersonalTask}>
                  <label>
                    Що треба зробити
                    <input name="title" placeholder="Підготуватися до модулю" required type="text" />
                  </label>
                  <label>
                    Дедлайн
                    <input name="deadline" required type="date" />
                  </label>
                  <label>
                    Пріоритет
                    <select defaultValue="medium" name="priority">
                      <option value="high">Високий</option>
                      <option value="medium">Середній</option>
                      <option value="low">Низький</option>
                    </select>
                  </label>
                  <label>
                    Статус
                    <select defaultValue="todo" name="status">
                      <option value="todo">Треба зробити</option>
                      <option value="inprogress">В процесі</option>
                      <option value="done">Готово</option>
                    </select>
                  </label>
                  <label className="grid-form__full">
                    Коментар
                    <textarea name="details" placeholder="Кроки для себе" rows="3" />
                  </label>
                  <button className="button button--primary" disabled={busy} type="submit">
                    Додати в особистий план
                  </button>
                </form>
                <TaskBoard
                  canEditTask={() => true}
                  onDelete={deletePersonalTask}
                  onStatusChange={(task, status) => updatePersonalTask(task, { status })}
                  onToggleComplete={(task, checked) =>
                    updatePersonalTask(task, { status: checked ? "done" : fallbackStatus(task.status) })
                  }
                  tasks={personalTasks}
                />
              </section>

              <section className="card card--wide">
                <div className="card__header">
                  <div>
                    <p className="section-tag">Тиждень</p>
                    <h2>Розклад групи</h2>
                  </div>
                </div>
                <div className="schedule-board">
                  {groupedSchedule.map((day) => (
                    <section className="schedule-day" key={day.day}>
                      <div className="schedule-day__header">
                        <h3>{day.day}</h3>
                        <span>{day.items.length} пар</span>
                      </div>
                      <div className="schedule-day__items">
                        {day.items.length ? (
                          day.items.map((item) => (
                            <article className="schedule-slot" key={item.id}>
                              <strong>
                                {item.time_start} • {item.subject}
                              </strong>
                              <span>{item.room ? `Аудиторія ${item.room}` : "Без аудиторії"}</span>
                            </article>
                          ))
                        ) : (
                          <div className="empty-state">Вільно</div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            </section>
          )}
        </section>
      )}
    </main>
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function formatDeadline(dateString) {
  const formatter = new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
  });
  const daysLeft = daysUntil(dateString);

  if (daysLeft < 0) return `Прострочено • ${formatter.format(new Date(dateString))}`;
  if (daysLeft === 0) return `Сьогодні • ${formatter.format(new Date(dateString))}`;
  if (daysLeft === 1) return `Завтра • ${formatter.format(new Date(dateString))}`;
  return `Через ${daysLeft} дн. • ${formatter.format(new Date(dateString))}`;
}

function fallbackStatus(status) {
  return status === "done" ? "todo" : status || "todo";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
