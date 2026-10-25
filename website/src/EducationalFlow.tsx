import { useState } from 'react';
import { MediaBlock } from './components/Media';
import { editorial } from './editorial';
const steps = [
  {
    title: 'Create the agreement',
    text: 'Record the purchase, delivery terms and inspection period.',
    media: 'business',
  },
  {
    title: 'Wait for partner confirmation',
    text: 'Payment confirmation and a protected arrangement are separate states. This demo uses a simulator.',
    media: 'payments',
  },
  {
    title: 'Inspect the delivery',
    text: 'Seller reports, courier events and buyer confirmation retain different provenance.',
    media: 'protection',
  },
  {
    title: 'Review before settlement',
    text: 'Acceptance or a reviewed dispute outcome leads to an approved partner instruction. AfriCore does not hold funds.',
    media: 'education',
  },
];
export function EducationalFlow() {
  const [step, setStep] = useState(0);
  return (
    <section className="educational-story">
      <div className="section-copy">
        <span className="eyebrow">
          UNDERSTAND THE WORKFLOW · SANDBOX EXAMPLE
        </span>
        <h2>
          Trust is a sequence.
          <br />
          Not a single checkmark.
        </h2>
        <p>
          See how agreement, payment evidence, delivery and a reviewed partner
          decision fit together.
        </p>
        <div
          className="story-steps"
          role="tablist"
          aria-label="Protected payment educational steps"
        >
          {steps.map((s, i) => (
            <button
              key={s.title}
              id={'story-tab-' + i}
              role="tab"
              aria-selected={step === i}
              aria-controls="story-panel"
              onClick={() => setStep(i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  setStep((i + 1) % steps.length);
                  (
                    document.getElementById(
                      'story-tab-' + ((i + 1) % steps.length),
                    ) as HTMLButtonElement
                  )?.focus();
                }
                if (e.key === 'ArrowLeft') {
                  setStep((i + steps.length - 1) % steps.length);
                  (
                    document.getElementById(
                      'story-tab-' + ((i + steps.length - 1) % steps.length),
                    ) as HTMLButtonElement
                  )?.focus();
                }
              }}
            >
              {String(i + 1).padStart(2, '0')}
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>
      <div
        className="story-panel"
        id="story-panel"
        role="tabpanel"
        aria-labelledby={'story-tab-' + step}
      >
        <MediaBlock key={step} media={editorial[steps[step].media]} />
        <h3>{steps[step].title}</h3>
        <p>{steps[step].text}</p>
        <small>
          Conceptual illustration · No live transaction or unconditional
          protection promise.
        </small>
      </div>
    </section>
  );
}
