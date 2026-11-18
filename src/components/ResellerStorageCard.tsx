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
          Gardés en coffre sécurisé chez Godot & Fils, au nom de chaque client, assurés. La garde est refacturée au coût
          par Orvia : {FEES.vaultPerGramYear.toLocaleString('fr-FR')} € par an et par gramme (0,04 € par mois), prélevée
          chaque mois en or sur votre compte, puis en euros sur le compte d’attente s’il n’y a plus d’or. Offerte à un
          enfant jusqu’à ses 18 ans.
        </Hint>
      </Card>
    </>
  );
}
