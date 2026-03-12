const mockEmployees = [
  {
    id: 1,
    first_name: "Petar",
    last_name: "Petrović",
    email: "petar@primer.rs",
    position: "Menadžer",
    gender: "Muški",
    phone: "+381601234567",
    address: "Knez Mihailova 1, Beograd",
    department: "Menadžment",
    active: true,
  },
  {
    id: 2,
    first_name: "Ana",
    last_name: "Jovanović",
    email: "ana@primer.rs",
    position: "Finansije",
    gender: "Ženski",
    phone: "+381607654321",
    address: "Terazije 5, Beograd",
    department: "Finansije",
    active: true,
  },
  {
    id: 3,
    first_name: "Nikola",
    last_name: "Marković",
    email: "nikola@primer.rs",
    position: "Analitičar",
    gender: "Muški",
    phone: "+381609876543",
    address: "Nemanjina 10, Beograd",
    department: "IT",
    active: true,
  },
  {
    id: 4,
    first_name: "Nikola",
    last_name: "Jovanovic",
    email: "nikola2@primer.rs",
    position: "Analitičar",
    gender: "Muški",
    phone: "+381611112233",
    address: "Bulevar Oslobođenja 22, Novi Sad",
    department: "IT",
    active: false,
  },
];

export async function getEmployees() {

  await new Promise(resolve => setTimeout(resolve, 300));

  return mockEmployees;

}

export async function changePassword(resetToken, newPassword) {
  await new Promise(resolve => setTimeout(resolve, 400));
  console.log("Mock: password changed", { resetToken, newPassword });
}