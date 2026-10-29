import { useEffect, useState } from 'react';
import { knowledgeChecks, learningPaths, learningVersion, parseLearningProgress } from './learningPaths';
const storageKey = 'africore.learn.device.v1';
export function LearningJourney({ slug, titles }: {
    slug?: string;
    titles: Record<string, string>;
}) {
    const [completed, setCompleted] = useState<string[]>([]), [loaded, setLoaded] = useState(false), [notice, setNotice] = useState(''), [choice, setChoice] = useState<number | null>(null);
    useEffect(() => { try {
        setCompleted(parseLearningProgress(localStorage.getItem(storageKey)));
    }
    catch {
        setNotice('Browser storage is unavailable. Progress lasts for this page only.');
    } setLoaded(true); }, []);
    function save(next: string[]) { setCompleted(next); try {
        localStorage.setItem(storageKey, JSON.stringify({ version: learningVersion, completed: next }));
    }
    catch {
        setNotice('Progress could not be saved on this device.');
    } }
    const path = slug ? learningPaths[slug] : undefined, check = slug ? knowledgeChecks[slug] : undefined;
    if (path)
        return <section className="learning-paths"><h2>Your lessons</h2><p>{path.objective}</p><p>{path.lessons.filter(id => completed.includes(id)).length} of {path.lessons.length} completed on this device.</p><ol>{path.lessons.map(id => <li key={id}><a href={'/learn/' + id}>{titles[id]}</a>{completed.includes(id) && ' · Completed'}{!completed.includes(id) && id === path.lessons.find(l => !completed.includes(l)) && ' · Suggested next lesson'}</li>)}</ol><p>These are learning recommendations. No service is activated by completing them.</p><ProgressPrivacy notice={notice}/></section>;
    if (slug)
        return <section className="learning-paths" key={slug}><h2>Check your understanding</h2>{check ? <fieldset><legend>{check.question}</legend>{check.choices.map((label, i) => <label key={label}><input type="radio" name={'check-' + slug} checked={choice === i} onChange={() => setChoice(i)}/>{label}</label>)}{choice !== null && <p role="status">{choice === check.answer ? 'Correct. ' : 'Try again. '}{check.explanation}</p>}</fieldset> : <p>Before continuing, explain the common mistake above in your own words and identify the evidence you would need to avoid it.</p>}<button className="secondary-button" disabled={!loaded || (!!check && choice !== check.answer)} onClick={() => save(completed.includes(slug) ? completed.filter(id => id !== slug) : [...completed, slug])}>{completed.includes(slug) ? 'Mark as unfinished' : 'Mark lesson complete'}</button><ProgressPrivacy notice={notice}/>{Object.entries(learningPaths).filter(([, p]) => p.lessons.includes(slug)).map(([id, p]) => <p key={id}><a href={'/learn/' + id}>Continue {p.title}</a></p>)}</section>;
    return <section className="learning-paths"><span className="eyebrow">Guided learning</span><h2>Start with a task you recognize.</h2><div className="lesson-grid">{Object.entries(learningPaths).map(([id, p]) => <a key={id} href={'/learn/' + id}><span>{p.audience}</span><h3>{p.title}</h3><p>{p.objective}</p><strong>{p.lessons.filter(l => completed.includes(l)).length} / {p.lessons.length} lessons completed</strong></a>)}</div><ProgressPrivacy notice={notice}/><button className="text-link" disabled={!completed.length} onClick={() => save([])}>Clear learning progress on this device</button></section>;
}
function ProgressPrivacy({ notice }: {
    notice: string;
}) { return <><p className="content-limitation">Learning progress is saved only in this browser, shared by people using this browser profile, and is separate from your account or workspace. No account is required. Clearing browser storage removes it.</p>{notice && <p role="status">{notice}</p>}</>; }
