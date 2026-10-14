export type LegalPageKind = "privacidade" | "termos";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type LegalDocument = {
  title: string;
  intro: string;
  updatedAt: string;
  sections: LegalSection[];
};

const UPDATED_AT = "14 de outubro de 2026";

/** Maps a pathname to a legal page, or null for every other route. */
export function getLegalPage(pathname: string): LegalPageKind | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/privacidade") return "privacidade";
  if (path === "/termos") return "termos";
  return null;
}

// Written from what the app actually stores and shares; review with a lawyer before a public launch.
export const legalDocuments: Record<LegalPageKind, LegalDocument> = {
  privacidade: {
    title: "Política de Privacidade",
    intro:
      "Esta política explica quais dados pessoais o GanhoCerto trata, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
    updatedAt: UPDATED_AT,
    sections: [
      {
        heading: "Dados que coletamos",
        items: [
          "Conta: nome, e-mail e senha. A senha é guardada apenas como hash, nunca em texto.",
          "O que você registra: veículos e perfis de custo, jornadas (data, faturamento, quilometragem, tempo e corridas), despesas, despesas recorrentes, metas, planos e registros de manutenção e os arquivos CSV que você importar.",
          "Uso do produto: eventos de ativação, como o momento em que você vê o primeiro resultado, e os feedbacks que você enviar pelo app.",
          "Assinatura: plano, status e período. Os dados do cartão são informados diretamente ao processador de pagamento e não passam pelo GanhoCerto.",
          "No navegador: o token da sua sessão e o último veículo usado ficam no armazenamento local (localStorage). Não usamos cookies de publicidade nem rastreadores de terceiros.",
        ],
      },
      {
        heading: "Para que usamos",
        items: [
          "Prestar o serviço: calcular resultados, metas, manutenção e relatórios a partir dos seus registros.",
          "Autenticar e proteger sua conta, inclusive enviar e-mails de redefinição de senha.",
          "Processar a assinatura do plano Pro, quando você contratar.",
          "Melhorar o produto com base no uso e nos feedbacks.",
          "Cumprir obrigações legais e regulatórias.",
        ],
      },
      {
        heading: "Bases legais",
        paragraphs: [
          "Tratamos os dados para executar o contrato de uso do serviço (art. 7º, V), por legítimo interesse em segurança e melhoria do produto (art. 7º, IX) e para cumprir obrigações legais (art. 7º, II).",
        ],
      },
      {
        heading: "Compartilhamento",
        paragraphs: [
          "Não vendemos seus dados. Eles são compartilhados apenas com operadores necessários para o serviço funcionar: provedores de hospedagem do app, da API e do banco de dados, o serviço de envio de e-mail e o processador de pagamento (como Stripe ou Mercado Pago) quando você assina o plano Pro. Esses operadores tratam os dados somente para executar o serviço.",
        ],
      },
      {
        heading: "Armazenamento e segurança",
        paragraphs: [
          "Os dados ficam nos servidores dos provedores de infraestrutura e trafegam por conexões HTTPS. Cada conta só acessa os próprios registros. Mantemos os dados enquanto sua conta estiver ativa; depois de um pedido de exclusão, eles são apagados ou anonimizados, salvo quando a lei exigir que sejam guardados.",
        ],
      },
      {
        heading: "Seus direitos",
        paragraphs: ["Pelo art. 18 da LGPD, você pode pedir a qualquer momento:"],
        items: [
          "Confirmação de que tratamos seus dados e acesso a eles.",
          "Correção de dados incompletos, inexatos ou desatualizados.",
          "Anonimização, bloqueio ou eliminação de dados desnecessários, e a exclusão da conta.",
          "Portabilidade dos dados a outro fornecedor.",
          "Informação sobre com quem compartilhamos seus dados.",
        ],
      },
      {
        heading: "Alterações",
        paragraphs: [
          "Se esta política mudar, a nova versão será publicada nesta página com a data de atualização. Mudanças relevantes também serão avisadas no app.",
        ],
      },
    ],
  },
  termos: {
    title: "Termos de Uso",
    intro: "Ao criar uma conta ou usar o GanhoCerto, você concorda com estes termos.",
    updatedAt: UPDATED_AT,
    sections: [
      {
        heading: "O serviço",
        paragraphs: [
          "O GanhoCerto ajuda motoristas de aplicativo e entregadores a organizar faturamento, custos e metas. Os resultados são estimativas calculadas a partir dos dados que você informa e não substituem orientação financeira, contábil ou fiscal.",
        ],
      },
      {
        heading: "Sua conta",
        items: [
          "Informe dados verdadeiros e mantenha seu e-mail atualizado.",
          "Você é responsável por guardar sua senha e pelo que for feito com a sua conta.",
          "Avise o suporte se suspeitar de acesso indevido.",
        ],
      },
      {
        heading: "Planos e pagamento",
        paragraphs: [
          "O plano gratuito tem recursos e limites próprios. O plano Pro é pago e contratado pelo processador de pagamento; preço, período e condições de cancelamento aparecem antes da contratação.",
        ],
      },
      {
        heading: "Uso aceitável",
        items: [
          "Não use o serviço para atividades ilegais.",
          "Não tente acessar dados de outras pessoas nem burlar a segurança do sistema.",
          "Não sobrecarregue o serviço com acessos automatizados.",
        ],
      },
      {
        heading: "Seus dados",
        paragraphs: [
          "Os registros que você cria continuam sendo seus. O tratamento deles segue a Política de Privacidade.",
        ],
      },
      {
        heading: "Disponibilidade",
        paragraphs: [
          "O GanhoCerto está em fase beta e pode passar por mudanças, instabilidades e interrupções. Trabalhamos para manter o serviço disponível, mas não garantimos funcionamento contínuo e sem erros.",
        ],
      },
      {
        heading: "Responsabilidade",
        paragraphs: [
          "As decisões tomadas com base nas estimativas do app são suas. Na medida permitida pela lei, o GanhoCerto não responde por perdas decorrentes de dados informados de forma incorreta ou de indisponibilidade do serviço.",
        ],
      },
      {
        heading: "Encerramento e alterações",
        paragraphs: [
          "Você pode deixar de usar o serviço e pedir a exclusão da conta quando quiser. Podemos suspender contas que violem estes termos. Os termos podem ser atualizados, com a nova versão publicada nesta página. Valem as leis do Brasil.",
        ],
      },
    ],
  },
};
