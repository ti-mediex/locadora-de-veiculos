import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { Contract, Vehicle, Renter } from "@/types/database";
import { formatCurrency, formatDate, maskCpf } from "@/lib/format";

const CYCLE_LABEL: Record<string, string> = {
  diario: "diário",
  semanal: "semanal",
  quinzenal: "quinzenal",
  mensal: "mensal",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  header: { borderBottom: "2 solid #2563eb", paddingBottom: 10, marginBottom: 16 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#2563eb" },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    backgroundColor: "#eff6ff",
    padding: 5,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 130, fontFamily: "Helvetica-Bold" },
  value: { flex: 1 },
  clause: { marginBottom: 6, textAlign: "justify", lineHeight: 1.4 },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 50 },
  signBox: { width: "45%", borderTop: "1 solid #1f2937", paddingTop: 4, textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#9ca3af" },
});

interface Props {
  contract: Contract;
  vehicle: Vehicle;
  renter: Renter;
  empresa?: string;
}

function ContractDocument({ contract, vehicle, renter, empresa = "FrotaGest Locadora" }: Props) {
  const ciclo = CYCLE_LABEL[contract.ciclo_cobranca] ?? contract.ciclo_cobranca;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>CONTRATO DE LOCAÇÃO DE VEÍCULO</Text>
          <Text style={styles.subtitle}>
            {empresa} · Contrato Nº {contract.numero} · Emitido em {formatDate(new Date().toISOString())}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCADORA</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Razão social:</Text>
            <Text style={styles.value}>{empresa}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCATÁRIO</Text>
          <View style={styles.row}><Text style={styles.label}>Nome:</Text><Text style={styles.value}>{renter.nome}</Text></View>
          <View style={styles.row}><Text style={styles.label}>CPF:</Text><Text style={styles.value}>{maskCpf(renter.cpf)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>CNH:</Text><Text style={styles.value}>{renter.cnh ?? "—"} (cat. {renter.categoria_cnh ?? "—"})</Text></View>
          <View style={styles.row}><Text style={styles.label}>Telefone:</Text><Text style={styles.value}>{renter.telefone ?? "—"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Endereço:</Text><Text style={styles.value}>{renter.endereco ?? "—"}, {renter.cidade ?? ""}{renter.estado ? `/${renter.estado}` : ""}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VEÍCULO</Text>
          <View style={styles.row}><Text style={styles.label}>Marca/Modelo:</Text><Text style={styles.value}>{vehicle.marca} {vehicle.modelo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Placa:</Text><Text style={styles.value}>{vehicle.placa}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Ano:</Text><Text style={styles.value}>{vehicle.ano_fabricacao}/{vehicle.ano_modelo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Cor:</Text><Text style={styles.value}>{vehicle.cor ?? "—"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>KM inicial:</Text><Text style={styles.value}>{contract.km_inicial ?? vehicle.km_atual}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONDIÇÕES FINANCEIRAS</Text>
          <View style={styles.row}><Text style={styles.label}>Valor do aluguel:</Text><Text style={styles.value}>{formatCurrency(contract.valor_aluguel)} ({ciclo})</Text></View>
          <View style={styles.row}><Text style={styles.label}>Caução:</Text><Text style={styles.value}>{formatCurrency(contract.valor_caucao)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Início:</Text><Text style={styles.value}>{formatDate(contract.data_inicio)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Término:</Text><Text style={styles.value}>{contract.data_fim ? formatDate(contract.data_fim) : "Indeterminado"}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLÁUSULAS</Text>
          <Text style={styles.clause}>1. O LOCATÁRIO declara receber o veículo em perfeitas condições de uso e conservação, comprometendo-se a devolvê-lo no mesmo estado.</Text>
          <Text style={styles.clause}>2. O pagamento do aluguel será efetuado de forma {ciclo}, no valor de {formatCurrency(contract.valor_aluguel)}, sob pena de multa e juros em caso de atraso.</Text>
          <Text style={styles.clause}>3. São de inteira responsabilidade do LOCATÁRIO as multas de trânsito, infrações e danos causados ao veículo durante a vigência deste contrato.</Text>
          <Text style={styles.clause}>4. A manutenção preventiva é de responsabilidade da LOCADORA; danos por mau uso correm por conta do LOCATÁRIO.</Text>
          <Text style={styles.clause}>5. A caução será devolvida ao término do contrato, descontados eventuais débitos, multas ou avarias.</Text>
          <Text style={styles.clause}>6. O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio, quitados os valores pendentes.</Text>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signBox}><Text>{empresa}</Text><Text>LOCADORA</Text></View>
          <View style={styles.signBox}><Text>{renter.nome}</Text><Text>LOCATÁRIO</Text></View>
        </View>

        <Text style={styles.footer}>
          Documento gerado eletronicamente pelo FrotaGest — sem validade jurídica até assinatura das partes.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateContractPdf(props: Props) {
  const blob = await pdf(<ContractDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contrato-${props.contract.numero}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
