export const FAMILY_CODE_PARAM = "family";
const FAMILY_CODE_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

export function familyCodeFromSearch(search = "") {
  const code = new URLSearchParams(search).get(FAMILY_CODE_PARAM) || "";
  return FAMILY_CODE_PATTERN.test(code) ? code : null;
}

export function hasFamilyCode(record, familyCode) {
  return record?.payload?.family_code === familyCode;
}
