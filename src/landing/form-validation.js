// The text of a browser validation bubble for the subscribe form, in the page language.
// `validity` is the input's ValidityState; `copy` is getLandingCopy(lang).subscribeForm.
export function validationMessage(field, validity, copy) {
  if (field === "consent") return copy.consentRequired;
  return validity?.valueMissing ? copy.emailMissing : copy.emailInvalid;
}
