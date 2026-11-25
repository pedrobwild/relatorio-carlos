import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { main, container, brand, h1, text, button, hr, footer } from './_estilo.ts'

interface Item { title: string; body?: string; url?: string }
interface Props { recipientName?: string; items?: Item[]; portalUrl?: string }

const assunto = (n: number) => `Você tem ${n} ${n === 1 ? 'notificação' : 'notificações'} no Portal Bwild`

const ResumoNotificacoes = ({ recipientName, items = [], portalUrl }: Props) => {
  const lista = Array.isArray(items) ? items : []
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{assunto(lista.length)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>PORTAL BWILD</Text>
          <Heading style={h1}>{assunto(lista.length)}</Heading>
          <Text style={text}>{recipientName ? `Olá, ${recipientName}.` : 'Olá.'} Este é o resumo das notificações que você ainda não leu.</Text>
          {lista.map((it, i) => (
            <Section key={i}>
              <Hr style={hr} />
              <Text style={{ ...text, fontWeight: 'bold', margin: '0 0 6px' }}>
                {it?.url ? <Link href={it.url} style={{ color: '#0a0a0a' }}>{it.title}</Link> : it?.title}
              </Text>
              {it?.body ? <Text style={text}>{it.body}</Text> : null}
            </Section>
          ))}
          {portalUrl ? (<Section style={{ margin: '24px 0' }}><Button style={button} href={portalUrl}>Acessar o portal</Button></Section>) : null}
          <Text style={footer}>Portal Bwild</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ResumoNotificacoes,
  subject: (d: Record<string, any>) => assunto(Array.isArray(d?.items) ? d.items.length : 0),
  displayName: 'Resumo de notificações',
  previewData: { recipientName: 'Bruna', portalUrl: 'https://bwildworkflow.com', items: [{ title: 'Novo relatório semanal', body: 'Villa Studios 2412', url: 'https://bwildworkflow.com' }, { title: 'Compra pendente: box' }] },
} satisfies TemplateEntry
