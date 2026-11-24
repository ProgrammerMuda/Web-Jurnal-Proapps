from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether)

OUT = "Perbedaan_Transfer_Terima_Kirim_Uang.pdf"
NAVY = colors.HexColor("#1F3A68")
LIGHT = colors.HexColor("#E3F2FB")
GRID = colors.HexColor("#B8C7D9")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontSize=18, textColor=NAVY, spaceAfter=4)
SUB = ParagraphStyle("SUB", parent=ss["Normal"], fontSize=9, textColor=colors.grey, alignment=1)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontSize=13, textColor=NAVY, spaceBefore=10, spaceAfter=4)
B = ParagraphStyle("B", parent=ss["Normal"], fontSize=9.5, leading=13)
C = ParagraphStyle("C", parent=B, fontSize=8.8, leading=11.5)
CB = ParagraphStyle("CB", parent=C, fontName="Helvetica-Bold", textColor=colors.white)
R = ParagraphStyle("R", parent=C, alignment=2)


def tbl(rows, widths, num_cols=()):
    data = []
    for i, r in enumerate(rows):
        row = []
        for j, cell in enumerate(r):
            st = CB if i == 0 else (R if j in num_cols else C)
            row.append(Paragraph(str(cell), st))
        data.append(row)
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def journal(title, desc, rows):
    data = [["Kode Akun", "Akun", "Debit (Rp)", "Kredit (Rp)"]] + rows
    total = "<b>Total</b>"
    amt = next(r[2] for r in rows if r[2])
    data.append(["", total, f"<b>{amt}</b>", f"<b>{amt}</b>"])
    return KeepTogether([
        Paragraph(title, H2),
        Paragraph(desc, B),
        Spacer(1, 4),
        tbl(data, [25 * mm, 70 * mm, 37 * mm, 37 * mm], num_cols=(2, 3)),
    ])


story = [
    Paragraph("Perbedaan Transfer Uang, Terima Uang, dan Kirim Uang", H1),
    Paragraph("Studi kasus di Jurnal by Mekari (PT kolang kaling segar) &middot; 05 November 2026", SUB),
    Spacer(1, 10),
    Paragraph(
        "Dokumen ini menjelaskan tiga jenis transaksi di menu <b>Kas &amp; Bank</b> berdasarkan "
        "transaksi yang benar-benar dibuat dan jurnal entry yang dihasilkan oleh sistem. "
        "Ketiganya sama-sama menggerakkan akun kas/bank, tetapi berbeda pada <b>arah uang</b> "
        "dan <b>akun lawannya</b>.", B),

    journal("1. Transfer Uang &mdash; Bank Transfer #10002",
            "Memindahkan Rp 1.000.000 dari <b>Rekening Bank</b> ke <b>Kas Kecil</b>. "
            "Uang hanya berpindah tempat di dalam perusahaan.",
            [["1-10004", "Kas Kecil", "1.000.000,00", ""],
             ["1-10002", "Rekening Bank", "", "1.000.000,00"]]),

    journal("2. Terima Uang &mdash; Bank Deposit #10002",
            "Menerima bunga bank Rp 500.000 ke <b>Rekening Bank</b>. "
            "Uang masuk dari pihak luar.",
            [["1-10002", "Rekening Bank", "500.000,00", ""],
             ["7-70000", "Pendapatan Bunga - Bank", "", "500.000,00"]]),

    journal("3. Kirim Uang &mdash; Bank Withdrawal #10002",
            "Membayar listrik kantor Rp 300.000 dari <b>Rekening Bank</b>. "
            "Uang keluar ke pihak luar.",
            [["6-60217", "Listrik", "300.000,00", ""],
             ["1-10002", "Rekening Bank", "", "300.000,00"]]),

    Paragraph("4. Tabel Perbandingan", H2),
    tbl([
        ["Aspek", "Transfer Uang", "Terima Uang", "Kirim Uang"],
        ["Arah uang", "Pindah antar akun kas/bank sendiri", "Masuk dari luar", "Keluar ke pihak luar"],
        ["Sisi Debit", "Akun kas/bank tujuan", "Akun kas/bank penerima", "Akun lawan (beban, aset, hutang, dll.)"],
        ["Sisi Kredit", "Akun kas/bank asal", "Akun lawan (pendapatan, modal, pinjaman, dll.)", "Akun kas/bank pembayar"],
        ["Akun lawan", "Wajib akun Kas &amp; Bank", "Bebas (akun apa saja)", "Bebas (akun apa saja)"],
        ["Jumlah baris", "Selalu 1 lawan 1", "Bisa banyak baris sumber", "Bisa banyak baris tujuan"],
        ["Pajak", "Tidak ada", "Ada kolom pajak per baris", "Ada kolom pajak &amp; pemotongan"],
        ["Kontak", "Tidak ada", "&quot;Yang Membayar&quot;", "&quot;Penerima&quot;"],
        ["Total kas &amp; bank", "Tetap", "Bertambah", "Berkurang"],
        ["Dampak Laba Rugi", "Tidak ada", "Ada jika lawannya pendapatan", "Ada jika lawannya beban"],
    ], [30 * mm, 46 * mm, 47 * mm, 47 * mm]),

    Paragraph("5. Ringkasan", H2),
    Paragraph("&bull; <b>Transfer Uang</b>: debit kas/bank tujuan, kredit kas/bank asal. "
              "Total kas &amp; bank tidak berubah, hanya posisinya yang bergeser.", B),
    Spacer(1, 3),
    Paragraph("&bull; <b>Terima Uang</b>: selalu <b>men-debit</b> kas/bank (kas bertambah). "
              "Akun lawan di sisi kredit bisa pendapatan, setoran modal, pinjaman masuk, dan lainnya.", B),
    Spacer(1, 3),
    Paragraph("&bull; <b>Kirim Uang</b>: selalu <b>meng-kredit</b> kas/bank (kas berkurang). "
              "Akun lawan di sisi debit bisa beban, pembelian aset, pembayaran hutang, dan lainnya.", B),

    Paragraph("6. Dampak ke Saldo", H2),
    tbl([
        ["Akun", "Saldo Awal", "Transfer", "Terima", "Kirim", "Saldo Akhir"],
        ["Rekening Bank", "17.800.000", "-1.000.000", "+500.000", "-300.000", "<b>17.000.000</b>"],
        ["Kas Kecil", "20.000.000", "+1.000.000", "", "", "<b>21.000.000</b>"],
    ], [34 * mm, 28 * mm, 27 * mm, 27 * mm, 27 * mm, 27 * mm], num_cols=(1, 2, 3, 4, 5)),
]


def footer(c, d):
    c.saveState()
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.grey)
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Halaman {d.page}")
    c.restoreState()


SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                  topMargin=16 * mm, bottomMargin=16 * mm,
                  title="Perbedaan Transfer, Terima, dan Kirim Uang").build(
    story, onFirstPage=footer, onLaterPages=footer)
print("OK", OUT)
