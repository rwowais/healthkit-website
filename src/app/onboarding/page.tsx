"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { quizQuestions, getRecommendation } from "@/lib/quiz";
import { saveProfile } from "@/lib/storage";
import { programs } from "@/lib/programs";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [showResult, setShowResult] = useState(false);

  const isNameStep = step === 0;
  const questionIndex = step - 1;
  const currentQuestion = quizQuestions[questionIndex];
  const totalSteps = quizQuestions.length + 1;
  const progress = ((step + 1) / (totalSteps + 1)) * 100;

  function handleAnswer(value: string) {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);
    if (questionIndex < quizQuestions.length - 1) {
      setStep(step + 1);
    } else {
      setShowResult(true);
    }
  }

  function handleFinish() {
    const rec = getRecommendation(answers);
    saveProfile({
      name,
      goal: answers["goal"] || "",
      experience: answers["experience"] || "",
      quizAnswers: answers,
      recommendedProgram: rec.programId,
      isPremium: false,
    });
    router.push("/dashboard");
  }

  if (showResult) {
    const rec = getRecommendation(answers);
    const program = programs.find((p) => p.id === rec.programId);
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#30d158]/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-[30px]">✓</span>
          </div>
          <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight">
            Great, {name || "there"}!
          </h1>
          <p className="mt-3 text-[17px] text-[#86868b] leading-relaxed">
            {rec.reason}
          </p>
          {program && (
            <div className="mt-8 bg-[#fbfbfd] rounded-2xl p-6 text-left border border-[#d2d2d7]/40">
              <p className="text-[11px] font-semibold text-[#0071e3] uppercase tracking-wider">
                Recommended for you
              </p>
              <h3 className="mt-2 text-[21px] font-semibold text-[#1d1d1f]">
                {program.name}
              </h3>
              <p className="mt-1 text-[14px] text-[#86868b]">
                {program.tagline} · {program.duration}
              </p>
            </div>
          )}
          <button
            onClick={handleFinish}
            className="mt-8 text-[17px] font-medium bg-[#0071e3] text-white px-10 py-3.5 rounded-full hover:bg-[#0077ed] transition-apple"
          >
            Go to Dashboard
          </button>
          <p className="mt-4 text-[13px] text-[#86868b]">
            You can always change your program later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-[#f5f5f7]">
        <div
          className="h-full bg-[#0071e3] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full">
          {isNameStep ? (
            <>
              <h1 className="text-[28px] sm:text-[32px] font-semibold text-[#1d1d1f] tracking-tight">
                What should we call you?
              </h1>
              <p className="mt-2 text-[15px] text-[#86868b]">
                This helps us personalize your experience.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
                className="mt-8 w-full text-[19px] px-0 py-3 border-b-2 border-[#d2d2d7] focus:border-[#0071e3] outline-none transition-apple bg-transparent text-[#1d1d1f] placeholder:text-[#d2d2d7]"
                autoFocus
              />
              <button
                onClick={() => setStep(1)}
                disabled={!name.trim()}
                className="mt-8 text-[17px] font-medium bg-[#0071e3] text-white px-10 py-3.5 rounded-full hover:bg-[#0077ed] transition-apple disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium text-[#86868b] mb-2">
                Question {questionIndex + 1} of {quizQuestions.length}
              </p>
              <h1 className="text-[28px] sm:text-[32px] font-semibold text-[#1d1d1f] tracking-tight">
                {currentQuestion.question}
              </h1>
              <div className="mt-8 space-y-3">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(opt.value)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border transition-apple ${
                      answers[currentQuestion.id] === opt.value
                        ? "border-[#0071e3] bg-[#0071e3]/5"
                        : "border-[#d2d2d7]/60 hover:border-[#86868b] hover:bg-[#fbfbfd]"
                    }`}
                  >
                    <p className="text-[15px] font-medium text-[#1d1d1f]">{opt.label}</p>
                    {opt.description && (
                      <p className="mt-0.5 text-[13px] text-[#86868b]">{opt.description}</p>
                    )}
                  </button>
                ))}
              </div>
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="mt-4 text-[13px] text-[#86868b] hover:text-[#1d1d1f] transition-apple"
                >
                  ← Back
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
