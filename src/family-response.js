export const ATTENDING = "attending";
export const DECLINED = "declined";
export const MAX_GUESTS = 20;

function clean(value) {
  return String(value || "").trim();
}

export function validateFamilyResponse({
  firstName,
  lastName,
  attendance,
  guestCount,
  participants,
}) {
  if (clean(firstName).length < 2) return "Укажите имя — не меньше двух букв.";
  if (clean(lastName).length < 2) return "Укажите фамилию — не меньше двух букв.";
  if (![ATTENDING, DECLINED].includes(attendance)) {
    return "Выберите, придёт ли кто-то из вашей семьи.";
  }
  if (attendance === DECLINED) return "";
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > MAX_GUESTS) {
    return `Укажите количество участников от 1 до ${MAX_GUESTS}.`;
  }
  if (!Array.isArray(participants) || participants.length !== guestCount) {
    return "Количество участников должно совпадать с числом заполненных гостей.";
  }
  const incompleteIndex = participants.findIndex((person) => (
    clean(person.first_name).length < 2 || clean(person.last_name).length < 2
  ));
  if (incompleteIndex >= 0) {
    return `Укажите имя и фамилию участника ${incompleteIndex + 1}.`;
  }
  return "";
}

export function buildFamilyResponsePayload({
  firstName,
  lastName,
  attendance,
  guestCount,
  participants,
  familyCode,
}) {
  const normalizedParticipants = attendance === ATTENDING
    ? participants.map((person) => ({
      first_name: clean(person.first_name),
      last_name: clean(person.last_name),
    }))
    : [];
  const normalizedCount = attendance === ATTENDING ? guestCount : 0;
  const fullName = `${clean(firstName)} ${clean(lastName)}`.trim();
  const participantNames = normalizedParticipants
    .map((person) => `${person.first_name} ${person.last_name}`)
    .join(", ");

  return {
    schema_version: 1,
    first_name: clean(firstName),
    last_name: clean(lastName),
    attendance,
    guest_count: normalizedCount,
    participants: normalizedParticipants,
    family_code: clean(familyCode),
    name: fullName,
    contact: attendance === ATTENDING ? "Да, придём" : "Не придём",
    problem: attendance === ATTENDING
      ? `Участников: ${normalizedCount}. ${participantNames}`
      : "Участников: 0",
  };
}
