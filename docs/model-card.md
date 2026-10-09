# Model card: topic proficiency classifier

## Purpose

Estimate a learner's proficiency in one topic (beginner, intermediate or advanced) from a five-question diagnostic, so PathForge can decide which topics count as mastered, which become available, and what level of resource to recommend.

It is a planning aid, not a certification. Its estimates should be treated as provisional and refined by further attempts.

## Inputs

Per attempt (`ml/features.py`, shared by training and serving):

- correctness overall, per difficulty, and weighted by difficulty (easy 1, medium 2, hard 3)
- response time relative to each difficulty's budget (30, 45 or 60 s), on a log scale, **bounded to roughly 0.22× to 4.5× and excluding answers under 3 s**
- self-reported confidence patterns: mean confidence, sure and correct, sure but wrong, correct guesses
- share of rapid answers (under 3 s)
- mean accuracy on the latest attempts of the topic's prerequisites, and how many were assessed
- the topic's depth in the prerequisite graph

Missing values (no hard questions answered, no prerequisites assessed) are median-imputed with missing-value indicators inside the pipeline.

## Output

Class probabilities, the most likely level, and a mastery score `P(intermediate) × 0.5 + P(advanced)`. The application treats 70% and above as mastered and 40–69% as developing.

**Validity rule (outside the model):** an attempt with three or more answers under three seconds is stored but does not change mastery.

## Training data

There is no real learner data yet, so the model is trained on **synthetic data** from `ml/data_generation.py`, generated with a fixed seed (42). Every row carries `is_synthetic = True`.

The simulator:

- gives each of 2,500 learners a general ability, per-domain affinities and per-topic noise; topic ability also depends on prerequisite ability and topic depth
- defines ground truth from latent ability: beginner below θ = −0.35, advanced above θ = 0.75 (class balance 45% / 34% / 22%)
- has learners attempt a random, prerequisite-ordered subset of their career's topics using the app's real item selection and real question bank
- models answers with a two-parameter IRT "knowledge" model, a 25% guessing floor and a 5% slip rate
- ties confidence to whether an item was known, with a per-learner overconfidence trait
- treats response time as only weakly related to ability (reading speed and noise dominate)
- makes 30% of learners rapid-guess on 10–60% of items, in under 3 s, at chance accuracy

## Evaluation

The split is by learner (80/20), so nobody appears in both sets. Model selection uses 5-fold GroupKFold on training learners only, by mean log loss. The held-out test set is used once, for reporting. All results are in `ml/artifacts/metrics.json` and on the app's model evaluation page.

| | Macro F1 | Accuracy | Log loss |
|---|---|---|---|
| Selected: histogram gradient boosting | 0.649 | 0.673 | 0.703 |
| Logistic regression | 0.649 | 0.672 | 0.702 |
| Accuracy thresholds tuned on train (baseline) | 0.560 | 0.600 | n/a |
| Majority class (baseline) | 0.209 | 0.457 | 11.25 |

- Macro-F1 gain over the threshold baseline: 0.089, 95% CI 0.068–0.109 (grouped bootstrap, 500 resamples)
- Expected calibration error: 0.011
- Spearman correlation of the mastery score with latent ability: 0.781 (raw accuracy: 0.626)
- Most errors are between adjacent levels
- Strongest features by permutation importance: difficulty-weighted score, accuracy, mean confidence, sure-and-correct rate

### Behavioural checks

Each training run predicts canonical answer patterns and records pass or fail. All nine currently pass:

| Pattern | Expected |
|---|---|
| All wrong, slow, marked guess | beginner |
| All wrong, quick (3–4 s), marked guess | beginner |
| All wrong, normal pace, marked unsure | beginner |
| All wrong, marked sure | beginner |
| Easy right, medium and hard wrong | beginner |
| All right, normal pace, marked sure | advanced |
| All right but slow (2 min each), unsure | intermediate or higher |
| All wrong, rapid clicks | not counted |
| All right, rapid clicks | not counted |

## History

The first version reached a higher test macro F1 (0.728), and it was wrong in a way the metrics didn't show. Clicking through the app, an attempt with every answer wrong, marked "guessing" and answered in about a second, was rated **advanced at 100%**. The simulator had only ever produced fast answers from strong learners, so the model learned "fast means expert" and extrapolated.

The fixes, in order:

1. Added disengaged rapid guessing to the simulator and a rapid-guess feature. Five rapid guesses then produced an uninformative estimate (intermediate), which is statistically honest but not a sensible product outcome.
2. Added the validity rule so attempts made mostly of rapid guesses aren't counted.
3. Found that all-wrong answers at 3–4 s were still rated intermediate: the simulator tied time to ability far more tightly than real timing is, so the model leaned on it and extrapolated linearly. Weakened and noised the simulated time effect, excluded rapid answers from time features and bounded the time ratio.
4. Made these patterns permanent behavioural checks.

Test macro F1 fell from 0.728 to 0.649. The earlier figure was inflated by an assumption built into the simulator, so the lower one is the more trustworthy.

## Limitations

- **Simulated ground truth.** Results show the model inverts its own simulator. Real accuracy is unknown, and real confidence and timing behaviour may differ from the simulator's assumptions.
- **Little evidence per attempt.** Five questions; about a third of simulated test attempts are misclassified.
- **Small item bank.** Six questions per topic, so retakes repeat items.
- **Fixed rapid-guess threshold.** Very fast readers on easy items could trip it; it isn't learned from data.
- **No forgetting.** Mastery doesn't decay with time.

## Recommended next steps

Collect real attempts (with consent), compare the simulator's assumptions against them, re-fit or at least re-calibrate on real data, expand the question bank, and consider an IRT model fitted to real responses in place of the simulator.
