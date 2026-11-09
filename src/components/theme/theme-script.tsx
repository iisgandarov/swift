import { THEME_COOKIE } from "@/lib/theme";

/**
 * Runs synchronously in <head> before first paint so the page never flashes
 * the wrong theme. Kept tiny and dependency-free on purpose.
 */
const code = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(\\w+)/);var t=m?m[1]:'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark')}else{r.classList.remove('dark')}r.dataset.theme=t;}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
