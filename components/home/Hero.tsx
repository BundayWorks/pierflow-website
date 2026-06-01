"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section
      className="relative mx-2 md:mx-4 mb-4 md:mb-6 rounded-[28px] overflow-hidden wave-bg"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #042520 0%, #063A33 25%, #0A7C6E 60%, #0DCE9A 90%, #7AE7C7 100%)",
      }}
    >
      <div className="relative max-w-[1200px] mx-auto px-6 lg:px-10 pt-28 pb-28 lg:pt-36 lg:pb-44 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display font-medium leading-[1.02] tracking-[-0.02em] text-[44px] sm:text-[60px] lg:text-[76px]"
          >
            <span
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #D1FF9A 0%, #A8F2A1 25%, #7AE7C7 55%, #FFFFFF 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              Turn health into
            </span>
            <br />
            <span
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #D1FF9A 0%, #A8F2A1 25%, #7AE7C7 55%, #FFFFFF 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              connected{" "}
            </span>
            <span className="text-white">infrastructure</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-7 text-[16px] md:text-[18px] leading-[1.55] text-white/85 max-w-[520px]"
          >
            Pierflow is the connectivity layer for healthcare in Africa.
            One API to move coverage, records, payments, and referrals
            between HMOs, providers, fintechs, and the platforms that
            serve them.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link href="/company/contact" className="pill-btn-light gradient-ring">
              Talk with our team
            </Link>
            <Link href="/developers/request-access" className="pill-btn-dark gradient-ring">
              Start building
            </Link>
          </motion.div>

          <p className="mt-8 text-[12px] uppercase tracking-[0.18em] text-white/55">
            Live in Nigeria · Built for Africa
          </p>
        </div>

        {/* Right-column SVG scene */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="hidden lg:block"
        >
          <HeroScene />
        </motion.div>
      </div>
    </section>
  );
}

function HeroScene() {
  return (
    <svg
      viewBox="0 0 520 480"
      className="w-full h-auto"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A8F2A1" />
          <stop offset="50%" stopColor="#7AE7C7" />
          <stop offset="100%" stopColor="#5BE9E0" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id="orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7AE7C7" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7AE7C7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* glow orb */}
      <circle cx="260" cy="240" r="220" fill="url(#orb)" />

      {/* concentric rings (network) */}
      {[60, 110, 165, 220].map((r, i) => (
        <circle
          key={r}
          cx="260"
          cy="240"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={i === 0 ? 1.5 : 1}
          strokeOpacity={0.55 - i * 0.1}
        />
      ))}

      {/* node points around middle ring */}
      {[
        [260, 75, "HMO"],
        [395, 165, "Hospital"],
        [395, 315, "Pharmacy"],
        [260, 405, "Fintech"],
        [125, 315, "Clinic"],
        [125, 165, "HR"],
      ].map(([x, y, label]) => (
        <g key={label as string}>
          <circle
            cx={x as number}
            cy={y as number}
            r="8"
            fill="#0a1f1b"
            stroke="#A8F2A1"
            strokeWidth="2"
          />
          <text
            x={x as number}
            y={(y as number) - 16}
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize="11"
            fontWeight="600"
            fill="#A8F2A1"
            stroke="#042520"
            strokeWidth="0.4"
            paintOrder="stroke"
          >
            {label}
          </text>
        </g>
      ))}

      {/* center card with verified policy */}
      <g transform="translate(180,200)">
        <rect
          x="0"
          y="0"
          width="160"
          height="90"
          rx="12"
          fill="url(#cardGrad)"
          stroke="rgba(10,31,27,0.06)"
        />
        <circle cx="20" cy="22" r="7" fill="#0DCE9A" />
        <rect x="34" y="17" width="80" height="8" rx="4" fill="#0a1f1b" opacity="0.78" />
        <rect x="34" y="30" width="50" height="6" rx="3" fill="#0a1f1b" opacity="0.35" />
        <rect x="14" y="52" width="132" height="6" rx="3" fill="#0a1f1b" opacity="0.12" />
        <rect x="14" y="64" width="88" height="6" rx="3" fill="#0a1f1b" opacity="0.12" />
        <g transform="translate(112, 58)">
          <rect width="34" height="20" rx="10" fill="#E6FBF3" />
          <text
            x="17"
            y="14"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="9"
            fill="#0A7C6E"
            fontWeight="600"
          >
            97
          </text>
        </g>
      </g>

      {/* floating mini-card top */}
      <g transform="translate(330, 110)">
        <rect width="120" height="44" rx="10" fill="#ffffff" opacity="0.95" />
        <circle cx="18" cy="22" r="6" fill="#0DCE9A" />
        <rect x="32" y="14" width="70" height="6" rx="3" fill="#0a1f1b" opacity="0.78" />
        <rect x="32" y="24" width="44" height="5" rx="2.5" fill="#0a1f1b" opacity="0.35" />
      </g>

      {/* floating mini-card bottom */}
      <g transform="translate(60, 330)">
        <rect width="130" height="44" rx="10" fill="#ffffff" opacity="0.95" />
        <circle cx="18" cy="22" r="6" fill="#7AE7C7" />
        <rect x="32" y="14" width="84" height="6" rx="3" fill="#0a1f1b" opacity="0.78" />
        <rect x="32" y="24" width="56" height="5" rx="2.5" fill="#0a1f1b" opacity="0.35" />
      </g>
    </svg>
  );
}
