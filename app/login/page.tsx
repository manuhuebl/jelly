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
        <input name="next" type="hidden" value={nextPath} />
        <div className="auth-field">
          <label>
            <span>Password</span>
            <input autoFocus name="password" type="password" />
          </label>
          <button aria-label="Open planner" type="submit" />
        </div>
        {hasError ? <p className="form-alert">wrong password</p> : null}
      </form>
    </main>
  );
}
