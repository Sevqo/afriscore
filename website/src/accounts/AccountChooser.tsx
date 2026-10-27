import { Logo } from "../components/Logo";
import { Icon, type IconName } from "../components/Icon";
import { MediaBlock } from "../components/Media";
import { editorial } from "../editorial";
import { types } from "./AccountUI";
import "./accounts.css";
export function AccountChooser() {
  return (
    <main className="account-entry">
      <Logo />
      <span className="eyebrow">ONE ACCOUNT. ROOM TO GROW.</span>
      <h1>How will you use AfriCore?</h1>
      <p>
        Choose the experience that fits you. You can add other workspaces later.
      </p>
      <div className="account-options">
        {types.map((t) => (
          <a
            className="account-option"
            key={t.kind}
            href={"/sign-up/" + t.kind}
          >
            <MediaBlock media={editorial[t.kind==='personal'?'personal':t.kind==='business'?'business':'developers']} /><Icon name={t.icon as IconName} />
            <h2>{t.title}</h2>
            <p>{t.description}</p>
            <strong>
              Continue as {t.title} <Icon name="right" />
            </strong>
          </a>
        ))}
      </div>
      <p>
        Already have an account? <a href="/login">Sign In</a>
      </p>

    </main>
  );
}
