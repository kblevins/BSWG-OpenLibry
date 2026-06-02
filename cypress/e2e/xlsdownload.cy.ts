/// <reference types="cypress" />

describe("Excel Export", () => {
  before(() => {
    cy.resetDatabase();
  });

  beforeEach(() => {
    cy.session("user-session", () => {
      cy.login();
    });
  });

  after(() => {
    cy.task("clearDownloads", "cypress/downloads");
  });

  const getExpectedFilename = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `Backup_OpenLibry_${yyyy}_${mm}_${dd}.xlsx`;
  };

  it("should export Excel file and validate its content", () => {
    cy.visit("http://localhost:3000/admin");
    cy.url().should("include", "/admin");

    cy.intercept("GET", "/api/excel").as("excelDownload");
    cy.get("[data-cy=admin-excel-backup-button]").click();
    cy.wait("@excelDownload", { timeout: 15000 })
      .its("response.statusCode")
      .should("eq", 200);

    const expectedFilename = getExpectedFilename();
    const downloadsFolder = "cypress/downloads";

    cy.readFile(`${downloadsFolder}/${expectedFilename}`, null, {
      timeout: 15000,
    }).should("exist");

    cy.task(
      "validateExcelStructure",
      `${downloadsFolder}/${expectedFilename}`,
    ).then((result: any) => {
      expect(result.worksheetCount).to.eq(2);
      expect(result.worksheetNames).to.include("Book List");
      expect(result.worksheetNames).to.include("User List");
    });

    cy.task(
      "validateBookColumns",
      `${downloadsFolder}/${expectedFilename}`,
    ).then((columns: any) => {
      expect(columns).to.include("Media Number");
      expect(columns).to.include("Title");
      expect(columns).to.include("Author");
      expect(columns).to.include("Rental Status");
      expect(columns).to.include("ISBN");
      expect(columns).to.include("Created At");
      expect(columns).to.include("Updated At");
      expect(columns).to.include("Rented Date");
      expect(columns).to.include("Due Date");
      expect(columns.length).to.eq(29);
    });

    cy.task(
      "validateUserColumns",
      `${downloadsFolder}/${expectedFilename}`,
    ).then((columns: any) => {
      expect(columns).to.include("ID");
      expect(columns).to.include("First Name");
      expect(columns).to.include("Last Name");
      expect(columns).to.include("School Grade");
      expect(columns).to.include("Active");
      expect(columns).to.include("Created At");
      expect(columns).to.include("Updated At");
      expect(columns).to.include("Teacher");
      expect(columns).to.include("Email");
      expect(columns.length).to.eq(9);
    });

    cy.task("validateExcelData", `${downloadsFolder}/${expectedFilename}`).then(
      (result: any) => {
        expect(result.booksRowCount).to.be.at.least(1);
        expect(result.usersRowCount).to.be.at.least(1);
        cy.log(`Books exported: ${result.booksRowCount - 1}`);
        cy.log(`Users exported: ${result.usersRowCount - 1}`);
      },
    );
  });
});
