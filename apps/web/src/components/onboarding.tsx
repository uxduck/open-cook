import { defaultFoodPreferences, type FoodPreferences } from "@open-cook/core";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  ChefHat,
  Clock3,
  Flame,
  Globe2,
  Heart,
  Leaf,
  Loader2,
  LogIn,
  Minus,
  Plus,
  Salad,
  Save,
  Sparkles,
  Target,
  UserPlus,
  Users,
  Utensils,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useSession } from "../context/SessionProvider";
import { Button } from "../ui";

type ListField =
  | "allergies"
  | "avoidedIngredients"
  | "cookingGoals"
  | "dietaryNeeds"
  | "equipment"
  | "favoriteCuisines"
  | "favoriteIngredients";

type Option<Value extends string = string> = {
  label: string;
  value: Value;
};

const preferenceStorageKey = "open-cook:food-preferences:v1";

const dietOptions: Array<Option<FoodPreferences["dietPattern"]>> = [
  { label: "Omnivore", value: "omnivore" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Pescatarian", value: "pescatarian" },
  { label: "Flexitarian", value: "flexitarian" },
];

const dietaryNeedOptions = [
  "Gluten-free",
  "Dairy-free",
  "Low sodium",
  "Low carb",
  "Halal",
  "Kosher",
];

const allergyOptions = [
  "Peanuts",
  "Tree nuts",
  "Dairy",
  "Eggs",
  "Gluten",
  "Soy",
  "Sesame",
  "Shellfish",
  "Fish",
];

const cuisineOptions = [
  "Italian",
  "Mexican",
  "Indian",
  "Japanese",
  "Thai",
  "Korean",
  "Mediterranean",
  "Middle Eastern",
];

const goalOptions = [
  "Quick and easy",
  "Healthy",
  "High protein",
  "Budget-friendly",
  "Batch cooking",
  "Family-friendly",
  "Comfort food",
  "Low waste",
];

const equipmentOptions = [
  "Oven",
  "Stovetop",
  "Microwave",
  "Air fryer",
  "Slow cooker",
  "Pressure cooker",
  "Blender",
  "Grill",
];

const spiceOptions: Array<Option<FoodPreferences["spiceLevel"]>> = [
  { label: "Mild", value: "mild" },
  { label: "Medium", value: "medium" },
  { label: "Hot", value: "hot" },
  { label: "Very hot", value: "very-hot" },
];

const timeOptions: Array<Option<string> & { minutes: number }> = [
  { label: "15 min", minutes: 15, value: "15" },
  { label: "30 min", minutes: 30, value: "30" },
  { label: "45 min", minutes: 45, value: "45" },
  { label: "60 min", minutes: 60, value: "60" },
  { label: "90+ min", minutes: 90, value: "90" },
];

const skillOptions: Array<Option<FoodPreferences["skillLevel"]>> = [
  { label: "Beginner", value: "beginner" },
  { label: "Confident", value: "confident" },
  { label: "Advanced", value: "advanced" },
];

const dietLabels = Object.fromEntries(
  dietOptions.map((option) => [option.value, option.label]),
) as Record<FoodPreferences["dietPattern"], string>;

const spiceLabels = Object.fromEntries(
  spiceOptions.map((option) => [option.value, option.label]),
) as Record<FoodPreferences["spiceLevel"], string>;

const skillLabels = Object.fromEntries(
  skillOptions.map((option) => [option.value, option.label]),
) as Record<FoodPreferences["skillLevel"], string>;

const dietValues = dietOptions.map((option) => option.value);
const spiceValues = spiceOptions.map((option) => option.value);
const skillValues = skillOptions.map((option) => option.value);

const inputClassName =
  "min-h-10 w-full rounded-lg border-2 border-(--border) bg-[color-mix(in_oklch,var(--background)_54%,white)] px-3 py-2 text-sm font-bold text-(--foreground) shadow-[2px_2px_0_var(--border)] outline-none placeholder:text-(--muted-foreground) focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklch,var(--ring)_54%,white)]";

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(
    0,
    24,
  );
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueList(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.slice(0, 80)),
  );
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function pickValue<Value extends string>(
  value: unknown,
  allowed: Value[],
  fallback: Value,
) {
  return allowed.includes(value as Value) ? (value as Value) : fallback;
}

function sanitizePreferences(value: unknown): FoodPreferences | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Partial<Record<keyof FoodPreferences, unknown>>;

  return {
    allergies: cleanList(source.allergies),
    avoidedIngredients: cleanList(source.avoidedIngredients),
    cookingGoals: cleanList(source.cookingGoals),
    dietaryNeeds: cleanList(source.dietaryNeeds),
    dietPattern: pickValue(
      source.dietPattern,
      dietValues,
      defaultFoodPreferences.dietPattern,
    ),
    equipment: cleanList(source.equipment),
    favoriteCuisines: cleanList(source.favoriteCuisines),
    favoriteIngredients: cleanList(source.favoriteIngredients),
    householdSize: clampNumber(
      source.householdSize,
      defaultFoodPreferences.householdSize,
      1,
      16,
    ),
    maxCookTimeMinutes: clampNumber(
      source.maxCookTimeMinutes,
      defaultFoodPreferences.maxCookTimeMinutes,
      10,
      180,
    ),
    skillLevel: pickValue(
      source.skillLevel,
      skillValues,
      defaultFoodPreferences.skillLevel,
    ),
    spiceLevel: pickValue(
      source.spiceLevel,
      spiceValues,
      defaultFoodPreferences.spiceLevel,
    ),
  };
}

function readStoredPreferences() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storage = window.localStorage;
    if (!storage) {
      return null;
    }
    const stored = storage.getItem(preferenceStorageKey);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as { preferences?: unknown };
    return sanitizePreferences(parsed.preferences);
  } catch {
    return null;
  }
}

function writeStoredPreferences(preferences: FoodPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storage = window.localStorage;
    if (!storage) {
      return;
    }
    storage.setItem(
      preferenceStorageKey,
      JSON.stringify({
        preferences,
        savedAt: new Date().toISOString(),
        version: 1,
      }),
    );
  } catch {
    // Some embedded browsers disable localStorage. Signed-in users still sync
    // through the API, and the form remains usable for the current session.
  }
}

function compactList(values: string[], emptyLabel: string) {
  return values.length ? values.join(", ") : emptyLabel;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { session, sessionLoading } = useSession();
  const [preferences, setPreferences] = useState<FoodPreferences>(() => {
    const stored = readStoredPreferences();
    return stored ?? defaultFoodPreferences;
  });
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    writeStoredPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (sessionLoading || !session) {
      return undefined;
    }

    let cancelled = false;
    setLoadingPreferences(true);
    api
      .getFoodPreferences()
      .then((result) => {
        if (cancelled || !result.preferences) {
          return;
        }
        setPreferences(result.preferences);
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusMessage(`Could not load saved preferences: ${errorMessage(error)}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPreferences(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  const summaryItems = useMemo(
    () => [
      {
        icon: <Leaf size={19} />,
        label: "Diet pattern",
        value: dietLabels[preferences.dietPattern],
      },
      {
        icon: <Salad size={19} />,
        label: "Additional needs",
        value: compactList(preferences.dietaryNeeds, "No extra rules"),
      },
      {
        icon: <AlertTriangle size={19} />,
        label: "Allergies",
        value: compactList(preferences.allergies, "None listed"),
      },
      {
        icon: <Ban size={19} />,
        label: "Avoid",
        value: compactList(preferences.avoidedIngredients, "Nothing listed"),
      },
      {
        icon: <Heart size={19} />,
        label: "Foods to use more",
        value: compactList(preferences.favoriteIngredients, "Open to anything"),
      },
      {
        icon: <Globe2 size={19} />,
        label: "Favorite cuisines",
        value: compactList(preferences.favoriteCuisines, "No preference"),
      },
      {
        icon: <Flame size={19} />,
        label: "Spice",
        value: spiceLabels[preferences.spiceLevel],
      },
      {
        icon: <Clock3 size={19} />,
        label: "Cooking time",
        value: `${preferences.maxCookTimeMinutes} min or less`,
      },
      {
        icon: <Target size={19} />,
        label: "Goals",
        value: compactList(preferences.cookingGoals, "No specific goals"),
      },
      {
        icon: <ChefHat size={19} />,
        label: "Skill level",
        value: skillLabels[preferences.skillLevel],
      },
      {
        icon: <Users size={19} />,
        label: "Household",
        value: `${preferences.householdSize} ${
          preferences.householdSize === 1 ? "person" : "people"
        }`,
      },
      {
        icon: <Utensils size={19} />,
        label: "Equipment",
        value: compactList(preferences.equipment, "No equipment listed"),
      },
    ],
    [preferences],
  );

  function setListPreference(field: ListField, next: string[]) {
    setSaveState("idle");
    setPreferences((current) => ({ ...current, [field]: uniqueList(next) }));
  }

  function toggleListValue(field: ListField, value: string) {
    const values = preferences[field];
    const next = values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
    setListPreference(field, next);
  }

  async function savePreferences() {
    setSaveState("saving");
    setStatusMessage("");
    writeStoredPreferences(preferences);

    if (!session) {
      setSaveState("saved");
      await navigate({ to: "/register" });
      return;
    }

    try {
      const saved = await api.updateFoodPreferences(preferences);
      setPreferences(saved.preferences);
      writeStoredPreferences(saved.preferences);
      setSaveState("saved");
      await navigate({ to: "/app" });
    } catch (error) {
      setSaveState("error");
      setStatusMessage(
        `Saved in this browser, but could not sync to your account: ${errorMessage(
          error,
        )}`,
      );
    }
  }

  function skipOnboarding() {
    void navigate({ to: session ? "/app" : "/register" });
  }

  return (
    <main className="min-h-screen bg-(--background) text-(--foreground) [font-family:var(--font-ui)]">
      <header className="border-b-2 border-(--border) bg-[color-mix(in_oklch,var(--background)_86%,white)] shadow-[0_2px_0_var(--border)]">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1220px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-lg text-xl font-black text-(--foreground)"
            to="/"
          >
            <img alt="" className="size-7" src="/logo.png" />
            OpenCook
          </Link>

          <nav
            className="flex flex-wrap items-center justify-end gap-2"
            aria-label="Account"
          >
            {session ? (
              <Button onClick={() => navigate({ to: "/app" })} size="sm">
                Open app
                <ArrowRight size={15} />
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate({ to: "/login" })} size="sm">
                  <LogIn size={15} />
                  Log in
                </Button>
                <Button
                  onClick={() => navigate({ to: "/register" })}
                  size="sm"
                  variant="primary"
                >
                  <UserPlus size={15} />
                  Create account
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1220px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:py-10">
        <div className="min-w-0">
          <div className="max-w-3xl">
            <h1 className="[font-family:var(--font-display)] text-[clamp(2rem,5vw,3.7rem)] font-black leading-[0.98] tracking-normal text-(--foreground)">
              Tell us your food preferences
            </h1>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-(--muted-foreground)">
              Set the defaults OpenCook should respect when adapting recipes for your
              kitchen.
            </p>
          </div>

          <div className="mt-7 border-y-2 border-(--border)">
            <QuestionRow
              description="Choose the closest everyday pattern."
              icon={<Leaf size={22} />}
              title="Diet pattern"
            >
              <SegmentedOptions
                options={dietOptions}
                selectedValue={preferences.dietPattern}
                onSelect={(value) => {
                  setSaveState("idle");
                  setPreferences((current) => ({ ...current, dietPattern: value }));
                }}
              />
            </QuestionRow>

            <QuestionRow
              description="Add rules recipes should respect."
              icon={<Salad size={22} />}
              title="Additional dietary needs"
            >
              <OptionGrid
                options={dietaryNeedOptions}
                selected={preferences.dietaryNeeds}
                onToggle={(value) => toggleListValue("dietaryNeeds", value)}
              />
            </QuestionRow>

            <QuestionRow
              description="Pick only the ones that matter."
              icon={<AlertTriangle size={22} />}
              title="Allergies / intolerances"
            >
              <div className="grid gap-3">
                <OptionGrid
                  options={allergyOptions}
                  selected={preferences.allergies}
                  onToggle={(value) => toggleListValue("allergies", value)}
                />
                <button
                  className={`inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-extrabold transition ${
                    preferences.allergies.length === 0
                      ? "border-(--color-sage) bg-(--color-sage-soft) text-(--color-sage)"
                      : "border-(--border) bg-(--card) text-(--muted-foreground) hover:bg-[color-mix(in_oklch,var(--secondary)_18%,white)] hover:text-(--foreground)"
                  }`}
                  onClick={() => setListPreference("allergies", [])}
                  type="button"
                >
                  {preferences.allergies.length === 0 ? <Check size={15} /> : null}
                  None
                </button>
              </div>
            </QuestionRow>

            <QuestionRow
              description="OpenCook will avoid suggesting these."
              icon={<Ban size={22} />}
              title="Ingredients to avoid"
            >
              <TagInput
                addLabel="Add avoid"
                onChange={(next) => setListPreference("avoidedIngredients", next)}
                placeholder="Cilantro, mushrooms, olives"
                values={preferences.avoidedIngredients}
              />
            </QuestionRow>

            <QuestionRow
              description="Ingredients you would happily see more often."
              icon={<Heart size={22} />}
              title="Foods you like"
            >
              <TagInput
                addLabel="Add food"
                onChange={(next) => setListPreference("favoriteIngredients", next)}
                placeholder="Beans, salmon, tofu, sweet potato"
                values={preferences.favoriteIngredients}
              />
            </QuestionRow>

            <QuestionRow
              description="Useful for suggestions and swaps."
              icon={<Globe2 size={22} />}
              title="Favorite cuisines"
            >
              <OptionGrid
                options={cuisineOptions}
                selected={preferences.favoriteCuisines}
                onToggle={(value) => toggleListValue("favoriteCuisines", value)}
              />
            </QuestionRow>

            <QuestionRow
              description="Set the default heat level."
              icon={<Flame size={22} />}
              title="Spice level"
            >
              <SegmentedOptions
                options={spiceOptions}
                selectedValue={preferences.spiceLevel}
                onSelect={(value) => {
                  setSaveState("idle");
                  setPreferences((current) => ({ ...current, spiceLevel: value }));
                }}
              />
            </QuestionRow>

            <QuestionRow
              description="How long should a normal recipe take?"
              icon={<Clock3 size={22} />}
              title="Cooking time"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {timeOptions.map((option) => (
                  <OptionButton
                    key={option.value}
                    label={option.label}
                    selected={preferences.maxCookTimeMinutes === option.minutes}
                    onClick={() => {
                      setSaveState("idle");
                      setPreferences((current) => ({
                        ...current,
                        maxCookTimeMinutes: option.minutes,
                      }));
                    }}
                  />
                ))}
              </div>
            </QuestionRow>

            <QuestionRow
              description="Pick the outcomes you care about."
              icon={<Target size={22} />}
              title="Cooking goals"
            >
              <OptionGrid
                options={goalOptions}
                selected={preferences.cookingGoals}
                onToggle={(value) => toggleListValue("cookingGoals", value)}
              />
            </QuestionRow>

            <QuestionRow
              description="This keeps instructions at the right depth."
              icon={<ChefHat size={22} />}
              title="Skill level"
            >
              <SegmentedOptions
                options={skillOptions}
                selectedValue={preferences.skillLevel}
                onSelect={(value) => {
                  setSaveState("idle");
                  setPreferences((current) => ({ ...current, skillLevel: value }));
                }}
              />
            </QuestionRow>

            <QuestionRow
              description="Set the usual number of servings."
              icon={<Users size={22} />}
              title="Household size"
            >
              <div className="flex flex-wrap items-center gap-3">
                <NumberStepper
                  max={16}
                  min={1}
                  onChange={(value) => {
                    setSaveState("idle");
                    setPreferences((current) => ({
                      ...current,
                      householdSize: value,
                    }));
                  }}
                  value={preferences.householdSize}
                />
                <span className="text-sm font-bold text-(--muted-foreground)">
                  {preferences.householdSize === 1 ? "person" : "people"}
                </span>
              </div>
            </QuestionRow>

            <QuestionRow
              description="Recipes can prefer the tools you own."
              icon={<Utensils size={22} />}
              title="Equipment you have"
            >
              <OptionGrid
                options={equipmentOptions}
                selected={preferences.equipment}
                onToggle={(value) => toggleListValue("equipment", value)}
              />
            </QuestionRow>
          </div>
        </div>

        <aside className="h-fit rounded-lg border-2 border-(--border) bg-[color-mix(in_oklch,var(--card)_82%,var(--color-sage-soft))] p-5 shadow-[var(--shadow-pop)] lg:sticky lg:top-6 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="[font-family:var(--font-display)] text-2xl font-black leading-none tracking-normal">
              Preference summary
            </h2>
            {loadingPreferences ? (
              <Loader2
                aria-label="Loading preferences"
                className="animate-spin text-(--color-sage)"
                size={18}
              />
            ) : null}
          </div>

          <div className="divide-y divide-(--color-line)">
            {summaryItems.map((item) => (
              <div
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-3"
                key={item.label}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-(--color-sage)">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-black leading-tight text-(--foreground)">
                    {item.label}
                  </strong>
                  <span className="mt-1 block break-words text-sm font-semibold leading-5 text-(--muted-foreground)">
                    {item.value}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t-2 border-dashed border-(--color-line) pt-4">
            <p className="flex items-start gap-2 text-sm font-extrabold leading-5 text-(--foreground)">
              <Sparkles className="mt-0.5 shrink-0 text-(--color-tomato)" size={16} />
              These preferences become your default recipe constraints.
            </p>
          </div>
        </aside>
      </section>

      <div className="border-t-2 border-(--border) bg-[color-mix(in_oklch,var(--background)_88%,white)] shadow-[0_-2px_0_var(--border)] md:sticky md:bottom-0">
        <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="min-h-6">
            {statusMessage ? (
              <p
                className={`text-sm font-extrabold ${
                  saveState === "error"
                    ? "text-(--destructive)"
                    : "text-(--muted-foreground)"
                }`}
                role={saveState === "error" ? "alert" : "status"}
              >
                {statusMessage}
              </p>
            ) : (
              <p className="text-sm font-semibold text-(--muted-foreground)">
                {session
                  ? "Signed in preferences sync to your OpenCook account."
                  : "Preferences are saved in this browser before account creation."}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button disabled={saveState === "saving"} onClick={skipOnboarding}>
              Skip for now
            </Button>
            <Button
              disabled={saveState === "saving" || sessionLoading}
              onClick={() => void savePreferences()}
              variant="primary"
            >
              {saveState === "saving" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : saveState === "saved" ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              Save and continue
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function QuestionRow({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3 border-b-2 border-(--color-line) py-5 last:border-b-0 md:grid-cols-[230px_minmax(0,1fr)] md:gap-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-(--border) bg-(--card) text-(--color-sage) shadow-[2px_2px_0_var(--border)]">
          {icon}
        </span>
        <span>
          <h2 className="text-base font-black leading-tight text-(--foreground)">
            {title}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-(--muted-foreground)">
            {description}
          </p>
        </span>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function OptionGrid({
  onToggle,
  options,
  selected,
}: {
  onToggle: (value: string) => void;
  options: string[];
  selected: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <OptionButton
          key={option}
          label={option}
          selected={selected.includes(option)}
          onClick={() => onToggle(option)}
        />
      ))}
    </div>
  );
}

function SegmentedOptions<Value extends string>({
  onSelect,
  options,
  selectedValue,
}: {
  onSelect: (value: Value) => void;
  options: Array<Option<Value>>;
  selectedValue: Value;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
      {options.map((option) => (
        <OptionButton
          key={option.value}
          label={option.label}
          selected={selectedValue === option.value}
          onClick={() => onSelect(option.value)}
        />
      ))}
    </div>
  );
}

function OptionButton({
  label,
  onClick,
  selected,
}: {
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-center text-sm font-extrabold leading-tight transition ${
        selected
          ? "border-(--color-sage) bg-(--color-sage-soft) text-(--color-sage) shadow-[2px_2px_0_var(--border)]"
          : "border-(--color-line) bg-(--card) text-(--foreground) hover:border-(--border) hover:bg-[color-mix(in_oklch,var(--secondary)_18%,white)]"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0 break-words">{label}</span>
      {selected ? <Check className="shrink-0" size={15} /> : null}
    </button>
  );
}

function NumberStepper({
  max,
  min,
  onChange,
  value,
}: {
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="inline-grid grid-cols-[42px_58px_42px] overflow-hidden rounded-lg border-2 border-(--border) bg-(--card) shadow-[2px_2px_0_var(--border)]">
      <button
        aria-label="Decrease household size"
        className="flex min-h-10 items-center justify-center border-r-2 border-(--border) text-(--foreground) transition hover:bg-(--color-rail) disabled:opacity-45"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        type="button"
      >
        <Minus size={16} />
      </button>
      <output className="flex min-h-10 items-center justify-center text-base font-black">
        {value}
      </output>
      <button
        aria-label="Increase household size"
        className="flex min-h-10 items-center justify-center border-l-2 border-(--border) text-(--foreground) transition hover:bg-(--color-rail) disabled:opacity-45"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        type="button"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

function TagInput({
  addLabel,
  onChange,
  placeholder,
  values,
}: {
  addLabel: string;
  onChange: (values: string[]) => void;
  placeholder: string;
  values: string[];
}) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const nextValue = draft.trim().slice(0, 80);
    if (!nextValue) {
      return;
    }
    onChange([...values, nextValue]);
    setDraft("");
  }

  function removeValue(value: string) {
    onChange(values.filter((item) => item !== value));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={inputClassName}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
          placeholder={placeholder}
          value={draft}
        />
        <Button
          className="shrink-0"
          disabled={!draft.trim()}
          onClick={addDraft}
          variant="secondary"
        >
          <Plus size={15} />
          {addLabel}
        </Button>
      </div>

      {values.length ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border-2 border-(--border) bg-(--card) px-3 py-1.5 text-sm font-extrabold text-(--foreground) shadow-[2px_2px_0_var(--border)] transition hover:bg-[color-mix(in_oklch,var(--destructive)_12%,white)]"
              key={value}
              onClick={() => removeValue(value)}
              type="button"
            >
              {value}
              <Minus size={14} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
