import { formatEur } from '../logic/format';
import { FEES } from '../logic/fees';
import { clientStorage } from '../logic/storageLimit';
import { useAccount, useBank } from '../state/BankProvider';
import { Card, Hint, KeyValue, SectionTitle } from './ui';
import { VaultLogo } from './VaultLogo';

/**
 * Lingotins gardés en coffre sécurisé chez le revendeur (Godot & Fils) : un seul mode de garde proposé aux clients,
 * enfants compris. Pas de seuil ni de grille à gérer : la garde est celle du tarif Orvia.
 */
export function ResellerStorageCard() {
  const account = useAccount();
  const { quote } = useBank();
  const groups = clientStorage(account, quote.prices.gold);
  if (!groups.length) return null;
  return (
    <>
      <SectionTitle right={<VaultLogo size={30} />}>Coffre sécurisé</SectionTitle>
      <Card style={{ gap: 8 }}>
        {groups.map((g) => {
          const owner = g.ownerChildId
            ? (account.children.find((c) => c.id === g.ownerChildId)?.name ?? 'Enfant')
            : 'Vous';
          return (
            <KeyValue
              key={g.ownerChildId ?? 'moi'}
              label={`${owner} · ${g.count} lingotin${g.count > 1 ? 's' : ''} ou pièce${g.count > 1 ? 's' : ''}`}
              value={formatEur(g.valueEur)}
            />
          );
        })}
        <Hint>
          Gardés en coffre sécurisé chez Godot & Fils, au nom de chaque client, assurés. La garde est à la charge
          d’Orvia pour l’instant ; pour un enfant, elle l’est jusqu’à ses 18 ans, puis il la paie (
          {(FEES.custodyYearly.gold * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % par an, en or).
        </Hint>
      </Card>
    </>
  );
}
