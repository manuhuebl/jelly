import { login } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params?.next ?? "/";
  const hasError = params?.error === "1";

  return (
    <main className="app-shell auth-shell">
      <header className="topbar">
        <img className="brand-logo" src="/logo/logo.png" alt="jelly" />
      </header>
      <form className="auth-card" action={login}>
        <p className="eyebrow">internal planner</p>
        <h1>password</h1>
        <input name="next" type="hidden" value={nextPath} />
        <label>
          <span>access</span>
          <input autoFocus name="password" type="password" />
        </label>
        {hasError ? <p className="form-alert">wrong password</p> : null}
        <button type="submit">open planner</button>
      </form>
    </main>
  );
}
