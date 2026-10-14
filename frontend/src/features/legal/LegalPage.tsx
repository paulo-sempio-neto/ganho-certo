import { motion, MotionConfig } from "framer-motion";

import { SUPPORT_EMAIL } from "../../utils/support";
import { AmbientBackground } from "../auth/AmbientBackground";
import { BrandMark } from "../auth/AuthShell";
import { reveal, stagger } from "../auth/motion";
import { legalDocuments, type LegalPageKind } from "./legalContent";

/** Public privacy policy and terms pages, in the same dark shell as the auth screens. */
export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const document = legalDocuments[kind];
  const other = kind === "privacidade" ? { href: "/termos", label: "Termos de Uso" } : { href: "/privacidade", label: "Política de Privacidade" };

  return (
    <MotionConfig reducedMotion="user">
      <div className="lux relative min-h-screen w-full overflow-x-clip">
        <AmbientBackground />
        <div className="relative z-10">
          <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/[0.04]">
            <a href="/" aria-label="Voltar para o início">
              <BrandMark />
            </a>
            <a href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Voltar
            </a>
          </header>
          <motion.main
            className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16"
            initial="hidden"
            animate="visible"
            variants={stagger(0.06, 0.05)}
          >
            <motion.div className="flex flex-col gap-3" variants={reveal}>
              <h1 className="text-4xl font-medium tracking-[-0.03em] text-white sm:text-5xl">{document.title}</h1>
              <p className="text-sm text-zinc-500">Última atualização: {document.updatedAt}</p>
              <p className="text-base leading-relaxed text-zinc-300">{document.intro}</p>
            </motion.div>

            {document.sections.map((section) => (
              <motion.section key={section.heading} className="flex flex-col gap-3" variants={reveal}>
                <h2 className="text-xl font-medium tracking-tight text-white">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-relaxed text-zinc-400">
                    {paragraph}
                  </p>
                ))}
                {section.items ? (
                  <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-relaxed text-zinc-400 marker:text-emerald-400">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </motion.section>
            ))}

            <motion.section className="flex flex-col gap-3 border-t border-white/[0.06] pt-8" variants={reveal}>
              <h2 className="text-xl font-medium tracking-tight text-white">Contato</h2>
              <p className="text-base leading-relaxed text-zinc-400">
                {SUPPORT_EMAIL ? (
                  <>
                    Para exercer seus direitos, pedir a exclusão da conta ou tirar dúvidas, escreva para{" "}
                    <a className="text-emerald-400 underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                      {SUPPORT_EMAIL}
                    </a>
                    .
                  </>
                ) : (
                  "Para exercer seus direitos, pedir a exclusão da conta ou tirar dúvidas, use \"Enviar feedback da beta\" no menu Mais, dentro do app."
                )}
              </p>
              <a className="text-sm text-emerald-400 underline-offset-4 hover:underline" href={other.href}>
                Ler também: {other.label}
              </a>
            </motion.section>
          </motion.main>
        </div>
      </div>
    </MotionConfig>
  );
}
