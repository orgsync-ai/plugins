// @ts-check
// D-195 choice 6, the never-capture topics, as word lists in English and French (plan B2 §4.10, layer 2). They are matched
// against text folded by `foldText`: lower case, accents removed, curly apostrophes made straight. A match drops the item on the
// person's side; the gate fails closed, so a dropped business decision is a missed suggestion, never a breach. Words that
// developers use in another sense are left out or narrowed ("race condition", "disabled button", "discriminated union",
// "diagnose a bug", "pip install", "dismiss a dialog"). tests/fixtures/capture-gate-g5.json is the labelled set (gate G5).

export const LEXICON_VERSION = "lexicon-2";

/** Lower case, accents removed, straight apostrophes, single spaces. @param {string} text */
export function foldText(text) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[‘’ʼ`]/g, "'").replace(/\s+/g, " ").trim();
}

/** @typedef {"health" | "family" | "hr" | "pay" | "union" | "legal_advice" | "special_category"} Topic */

/** Each topic's patterns, over folded text. @type {Readonly<Record<Topic, { en: readonly string[], fr: readonly string[] }>>} */
export const TOPICS = Object.freeze({
  health: {
    en: ["\\b(sick|ill) (leave|day|days|note)\\b", "\\b(called|calling|is|was|been|feeling|felt|got|getting) (in )?sick\\b", "\\billness(es)?\\b",
      "\\bdiagnos(ed|is) (with|of)\\b", "\\bmedical (leave|condition|appointment|reasons|history|records?|issue|test|treatment)\\b",
      "\\bdoctor'?s? (note|appointment|visit|orders)\\b", "\\btherap(y|ist|ies)\\b", "\\bmental health\\b", "\\bdepress(ion|ed)\\b", "\\banxiety\\b",
      "\\bpanic attacks?\\b", "\\bcancer\\b", "\\bchemo(therapy)?\\b", "\\bsurgery\\b", "\\bpregnan(t|cy)\\b", "\\bmiscarriage\\b",
      "\\bmedications?\\b", "\\bprescriptions?\\b", "\\bhospitali[sz](ed|ation)\\b", "\\bin (the )?hospital\\b", "\\bdisabilit(y|ies)\\b",
      "\\bdisabled (person|people|employee|colleague|son|daughter|child)\\b", "\\bchronic (pain|illness|condition|fatigue)\\b",
      "\\bhealth (condition|issue|issues|problem|problems|reasons|scare|crisis)\\b", "\\bburn(ed|t)? ?out\\b", "\\badhd\\b", "\\bautis(m|tic)\\b",
      "\\bbipolar\\b", "\\bdiabet(es|ic)\\b", "\\brehab\\b", "\\baddiction\\b", "\\binjur(y|ies|ed)\\b"],
    fr: ["\\bmalade\\b", "\\bmaladie\\b", "\\bdiagnostique (de|d'un|d'une)\\b", "\\b(rendez-vous|dossier|conge|raisons?) medica(l|le|ux|les)\\b",
      "\\bmedecin\\b", "\\btherapi(e|es)\\b", "\\btherapeute\\b", "\\bpsychologue\\b", "\\bsante mentale\\b", "\\bdepression\\b", "\\banxiete\\b",
      "\\bcrises? de panique\\b", "\\bcancer\\b", "\\bchimio(therapie)?\\b", "\\bchirurgie\\b", "\\benceinte\\b", "\\bgrossesse\\b",
      "\\bfausse couche\\b", "\\bmedicaments?\\b", "\\bordonnance medicale\\b", "\\bhospitalise(e)?\\b", "\\ba l'hopital\\b", "\\bhandicap(e|ee)?\\b",
      "\\bepuisement professionnel\\b", "\\bburn-?out\\b", "\\b(conge|arret) (de )?maladie\\b", "\\bblessure\\b", "\\bproblemes? de sante\\b"]
  },
  family: {
    en: ["\\bdivorc(e|ed|ing)\\b", "\\bcustody\\b", "\\bmy (wife|husband|spouse|kids?|children|son|daughter|mom|mum|mother|dad|father|parents?|baby|family|brother|sister|grandmother|grandfather|grandma|grandpa|fiance|fiancee|girlfriend|boyfriend)\\b",
      "\\b(his|her|their) (wife|husband|spouse|kids|children|son|daughter|mom|mum|mother|dad|father|parents|baby|family|girlfriend|boyfriend)\\b",
      "\\bfamily (emergency|matter|matters|reasons|issue|issues|crisis|situation)\\b", "\\bfuneral\\b", "\\bbereavement\\b", "\\bpassed away\\b",
      "\\bmaternity\\b", "\\bpaternity\\b", "\\bparental leave\\b", "\\bchildcare\\b", "\\bdaycare\\b", "\\bnewborn\\b", "\\bhoneymoon\\b"],
    fr: ["\\bdivorc(e|er|ee|ent)\\b", "\\bgarde (des|de mes|de ses|de leurs) enfants\\b", "\\b(ma|sa) (femme|conjointe|fille|mere|soeur|grand-mere|blonde)\\b",
      "\\b(mon|son) (mari|conjoint|fils|pere|frere|grand-pere|chum|bebe)\\b", "\\b(mes|ses|leurs) (enfants|parents|petits-enfants)\\b",
      "\\burgence familiale\\b", "\\braisons familiales\\b", "\\bfunerailles\\b", "\\bobseques\\b", "\\bdeuil\\b", "\\bdeces\\b",
      "\\bconge (de )?(maternite|paternite|parental)\\b", "\\bgarderie\\b", "\\bnouveau-ne\\b", "\\blune de miel\\b"]
  },
  hr: {
    en: ["\\bgrievances?\\b", "\\bharass(ed|ment|ing)\\b", "\\bbull(y|ied|ying)\\b", "\\bdiscriminat(ion|ory|ed against)\\b", "\\bhostile work environment\\b",
      "\\bdisciplinary\\b", "\\b(written|final|verbal) warning\\b", "\\bperformance improvement plan\\b", "\\bmisconduct\\b",
      "\\bfir(e|ed|ing) (him|her|them|someone|an employee|the employee)\\b", "\\b(got|get|gets|was|were|be|been|being) fired\\b", "\\blet(ting)? (?!(it|that|this|us|me|everything|something|the|things)\\b)[a-z]+ go\\b",
      "\\bterminat(e|ed|ing|ion of) (his|her|their|the employee'?s?) (employment|contract)\\b", "\\btermination of employment\\b", "\\bdismissal\\b",
      "\\b(was|were|been|be) dismissed from\\b", "\\bresign(ed|ation|ing)?\\b", "\\bquit(ting)? (the company|his job|her job|their job|my job)\\b",
      "\\bdemot(e|ed|ion)\\b", "\\bcomplaint against\\b", "\\b(filed|file|filing) a complaint\\b", "\\bformal complaint\\b",
      "\\bhr (complaint|investigation|case|issue|matter)\\b", "\\bunderperform(s|ed|ing|ance)? (employee|colleague|teammate|engineer|rep)\\b",
      "\\b(he|she|they)('s| is| are)? underperforming\\b", "\\btoxic (manager|boss|colleague)\\b", "\\bperformance review (of|for) (him|her|them)\\b"],
    fr: ["\\bgriefs?\\b", "\\bharcel(ement|er|e)\\b", "\\bintimidation\\b", "\\bdiscrimination\\b", "\\bmilieu de travail toxique\\b",
      "\\b(mesure|sanction)s? disciplinaires?\\b", "\\bavertissement (ecrit|final|verbal)\\b", "\\bplan d'amelioration (du rendement|de la performance)\\b",
      "\\binconduite\\b", "\\bcongedi(er|e|ee|ement)\\b", "\\blicenci(er|e|ee|ement)\\b", "\\brenvoy(er|e|ee) (un|une|le|la) (employe|employee)\\b",
      "\\bdemission(ne|ner|nee)?\\b", "\\bretrograd(ation|e|er)\\b", "\\bplainte (contre|formelle)\\b", "\\benquete (rh|interne)\\b",
      "\\bmauvais rendement\\b", "\\bsous-performance\\b"]
  },
  pay: {
    en: ["\\bsalar(y|ies)\\b", "\\bwages?\\b", "\\b(pay|salary) (raise|rise|cut|bump|band|grade|review|stub|slip)s?\\b",
      "\\b(a|her|his|their|my|your) raise\\b", "\\b(his|her|their|my|your) (pay|compensation|bonus|equity|stock options|commission)\\b",
      "\\bcompensation\\b", "\\bbonus(es)?\\b(?! (credits?|features?|points|tracks?|content|materials?|chapters?))", "\\bpayroll\\b", "\\bseverance\\b", "\\bovertime pay\\b",
      "\\bstock options\\b", "\\bequity grant\\b", "\\bsigning bonus\\b"],
    fr: ["\\bsalaires?\\b", "\\bsalarial(e|es)?\\b", "\\bremuneration\\b", "\\b(sa|son|ma|mon|leur) (paie|paye|prime|augmentation)\\b",
      "\\baugmentation (de salaire|salariale)\\b", "\\bbaisse de salaire\\b", "\\bechelle salariale\\b", "\\b(bulletin|talon|fiche) de paie\\b",
      "\\bindemnite de depart\\b", "\\bheures supplementaires payees\\b", "\\boptions d'achat d'actions\\b", "\\bprime de signature\\b"]
  },
  union: {
    en: ["\\blabou?r union\\b", "\\btrade union\\b", "\\bunioni[sz](e|ed|ing|ation)\\b",
      "\\bunion (rep|reps|representative|steward|dues|meeting|drive|organi[sz]\\w*|vote|card|cards|membership|contract)\\b",
      "\\bjoin(s|ed|ing)? (the|a) union\\b", "\\bcollective (bargaining|agreement)\\b", "\\bshop steward\\b", "\\bon strike\\b", "\\bstrike (vote|action)\\b",
      "\\bpicket(s|ing|line)?\\b", "\\bwalk ?out\\b"],
    fr: ["\\bsyndicat(s)?\\b", "\\bsyndica(l|le|ux|les|liste|lisation|liser)\\b", "\\bsyndiqu(e|es|ee|ees|er)\\b", "\\bconvention collective\\b",
      "\\bnegociation collective\\b", "\\bgreve\\b", "\\bpiquet de greve\\b", "\\bdebrayage\\b"]
  },
  legal_advice: {
    en: ["\\bmy (lawyer|attorney|solicitor|immigration|visa|green card|work permit|lawsuit|landlord|tenancy|eviction|taxes|tax return)\\b",
      "\\bmy (legal|court) (case|issue|matter|situation|advice|date)\\b", "\\bmy lease\\b",
      "\\b(i'?m|i am|i was|i've been|i have been) (being )?(sued|arrested|charged|summoned)\\b", "\\b(sue|suing) me\\b", "\\b(should|can|could) i sue\\b",
      "\\blegal advice (for|on|about) my\\b", "\\bpersonal (legal|tax) (advice|matter|issue)\\b"],
    fr: ["\\bmon avocat(e)?\\b", "\\bmon notaire\\b", "\\bmon (dossier|probleme|litige|proces) (juridique|judiciaire)\\b",
      "\\bmon (visa|permis de travail|statut d'immigration|bail|proprietaire)\\b", "\\bmon immigration\\b",
      "\\bma (demande d'immigration|residence permanente|declaration d'impots|poursuite)\\b", "\\bon me poursuit\\b", "\\bje (suis|me fais) poursuivi(e)?\\b",
      "\\bje veux poursuivre\\b", "\\bconseil juridique (personnel|pour moi)\\b", "\\bmes impots\\b"]
  },
  // D-205: the special categories of personal information (GDPR art. 9 and 10, Quebec's sensitive information, California's
  // sensitive personal information), here only where the text is plainly about one person. A rule that only names a category
  // (we never ask about religion) stays; the same words about a named person are personal attributes below.
  special_category: {
    en: ["\\b(was|were|been|got|is|being) (arrested|convicted|incarcerated|jailed)\\b", "\\b(came|comes|coming) out as\\b",
      "\\bmy (religion|faith|religious beliefs|ethnicity|ethnic background|sexual orientation|sex life|gender identity|criminal record|political views|dna|genetic test)\\b", "\\bi('m| am) (muslim|christian|jewish|hindu|sikh|buddhist|atheist|gay|lesbian|bisexual|transgender|queer)\\b"],
    fr: ["\\b(a ete|est|etait) (arrete|arretee|condamne|condamnee|incarcere|incarceree)\\b", "\\bfait son coming[- ]out\\b",
      "\\bma (religion|foi|vie sexuelle|orientation sexuelle|identite de genre|origine ethnique)\\b", "\\bmon (casier judiciaire|appartenance politique)\\b",
      "\\bmes (opinions politiques|croyances religieuses|antecedents judiciaires)\\b", "\\bje suis (musulman|musulmane|chretien|chretienne|juif|juive|hindou|hindoue|athee|gai|gaie|lesbienne|bisexuel|bisexuelle|transgenre)\\b"]
  }
});

/** Personal attributes: dropped when the item also names an individual (third-party personal data), kept in a rule about them. */
export const PERSONAL_ATTRIBUTES = Object.freeze({
  en: ["\\bhome address\\b", "\\bpersonal (address|phone|cell|mobile|email)\\b", "\\blives (at|on)\\b", "\\b(his|her|their) (home )?address\\b",
    "\\b(his|her|their) (phone|cell|mobile) number\\b", "\\bdate of birth\\b", "\\bbirthday\\b", "\\bborn in \\d{4}\\b", "\\b\\d{2} years old\\b",
    "\\bturn(s|ed)? \\d{2}\\b", "\\breligio(n|us)\\b", "\\b(muslim|christian|jewish|hindu|sikh|buddhist|atheist)\\b", "\\bethnic(ity)?\\b",
    "\\bsexual orientation\\b", "\\b(gay|lesbian|bisexual|transgender)\\b", "\\bimmigration status\\b", "\\bundocumented\\b", "\\bcriminal record\\b",
    "\\barrest record\\b", "\\bpolitical (views|affiliation|party)\\b", "\\bmarital status\\b", "\\bsingle (mother|father|parent)\\b", "\\bcredit score\\b",
    "\\bpersonal bankruptcy\\b",
    "\\bpolitical (opinions?|beliefs|leanings)\\b", "\\bsex life\\b", "\\bgender identity\\b", "\\bgenetic (test|testing|data|information|results?)\\b",
    "\\bdna (test|tests|results?)\\b", "\\bbiometric (data|information)\\b", "\\bfingerprints?\\b", "\\bcriminal (history|convictions?|charges?)\\b"],
  fr: ["\\badresse (personnelle|du domicile|de domicile)\\b", "\\b(il|elle) habite\\b", "\\b(son|sa) adresse\\b", "\\b(son|sa) numero de (telephone|cellulaire)\\b",
    "\\btelephone personnel\\b", "\\bdate de naissance\\b", "\\b(son|sa) anniversaire\\b", "\\bne(e)? en \\d{4}\\b", "\\ba \\d{2} ans\\b", "\\breligi(on|eux|euse)\\b",
    "\\b(musulman|musulmane|chretien|chretienne|juif|juive|hindou|hindoue|athee)\\b", "\\b(ethnie|origine ethnique)\\b", "\\borientation sexuelle\\b",
    "\\b(gai|gaie|lesbienne|bisexuel|bisexuelle|transgenre)\\b", "\\bstatut d'immigration\\b", "\\bsans papiers\\b", "\\bcasier judiciaire\\b",
    "\\bopinions? politiques?\\b", "\\betat civil\\b", "\\b(mere|pere|parent) monoparental(e)?\\b", "\\bcote de credit\\b", "\\bfaillite personnelle\\b",
    "\\bvie sexuelle\\b", "\\bidentite de genre\\b", "\\b(donnees|tests?) genetiques?\\b", "\\bdonnees biometriques\\b", "\\bempreintes digitales\\b", "\\bantecedents judiciaires\\b"]
});

/** Signs that a text is about one individual: a personal pronoun in English or French. Names are found in `individualNamed`. */
export const INDIVIDUAL_WORDS = Object.freeze(["\\b(he|she|him|his|her|hers|herself|himself)\\b", "\\b(il|elle|lui)\\b"]);
