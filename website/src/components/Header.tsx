import { useEffect, useRef, useState } from 'react';
import { groups, productSections } from '../navigation';
import { useFocusScope } from './useFocusScope';
import { Logo } from './Logo';
import { Icon } from './Icon';
export function Header() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLElement>(null);
  const close = () => {
    setOpen(false);
    setCategory('');
    setSearching(false);
  };
  useFocusScope(open || searching, close, root);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    function outside(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setCategory('');
    }
    function resize() {
      if (window.innerWidth > 1024) setOpen(false);
    }
    document.addEventListener('keydown', key);
    document.addEventListener('click', outside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('click', outside);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <header className="site-header" ref={root}>
      <Logo />
      <div className="header-tools">
        <button
          className="icon-button"
          aria-label={searching ? 'Close search' : 'Search AfriCore'}
          aria-expanded={searching}
          onClick={() => {
            setSearching(!searching);
            setOpen(false);
          }}
        >
          <Icon name={searching ? 'close' : 'search'} />
        </button>
        <a
          className="icon-button mobile-account"
          href="/signin"
          aria-label="Sign in"
        >
          <Icon name="user" />
        </a>
        <button
          className="menu-toggle icon-button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => {
            setOpen(!open);
            setSearching(false);
          }}
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
      <nav
        id="main-nav"
        className={open ? 'open' : ''}
        aria-label="Main navigation"
      >
        {Object.entries(groups).map(([label, links]) => (
          <div className="nav-group" key={label}>
            <button
              className="nav-category"
              data-autofocus={open && label === 'Products' ? true : undefined}
              aria-expanded={category === label}
              aria-controls={'nav-' + label}
              onClick={() => setCategory(category === label ? '' : label)}
            >
              {label}
              <Icon name="down" />
            </button>
            {
              <div
                className="nav-menu"
                id={'nav-' + label}
                hidden={category !== label}
              >
                <span className="nav-caption">
                  Explore {label.toLowerCase()}
                </span>
                {(label === 'Products'
                  ? productSections.map((section) => ({
                      title: section.title,
                      links: section.paths.map((path) =>
                        links.find(([, url]) => url === path)!,
                      ),
                    }))
                  : [{ title: '', links }]
                ).map((section) => (
                  <div className="nav-column" key={section.title}>
                    {section.title && <h3>{section.title}</h3>}
                    {section.links.map(([text, url]) => (
                      <a
                        href={url}
                        key={url}
                        aria-current={
                          location.pathname === url ? 'page' : undefined
                        }
                        onClick={close}
                      >
                        {text}
                        <Icon name="right" />
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            }
          </div>
        ))}
        <a className="support-link" href="/support">
          Support
        </a>
        <a className="signin-link" href="/signin">
          Sign in
        </a>
        <a className="button small" href="/get-started">
          Get started
        </a>
      </nav>
      {searching && (
        <section
          className="site-search"
          role="search"
          aria-label="Search AfriCore pages"
        >
          <label htmlFor="site-query">Find a product or resource</label>
          <input
            id="site-query"
            data-autofocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search payments, Passport, developers…"
          />
          <div className="search-results">
            {Object.values(groups)
              .flat()
              .filter(([title]) =>
                title.toLowerCase().includes(query.toLowerCase()),
              )
              .map(([title, url]) => (
                <a key={url} href={url}>
                  {title}
                  <Icon name="right" />
                </a>
              ))}
          </div>
        </section>
      )}
    </header>
  );
}
