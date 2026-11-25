import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { main, container, brand, h1, text, button, footer } from './_estilo.ts'

interface Props { recipientName?: string; title?: string; body?: string; url?: string }

const MencaoInterna = ({ recipientName, title, body, url }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{title || 'Você foi marcado numa observação interna'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>PORTAL BWILD</Text>
        <Heading style={h1}>{title || 'Você foi marcado numa observação interna'}</Heading>
        <Text style={text}>{recipientName ? `Olá, ${recipientName}.` : 'Olá.'}</Text>
        <Text style={text}>Você foi marcado numa observação interna.</Text>
        {body ? <Text style={text}>{body}</Text> : null}
        {url ? (<Section style={{ margin: '20px 0' }}><Button style={button} href={url}>Abrir no portal</Button></Section>) : null}
        <Text style={footer}>Portal Bwild</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MencaoInterna,
  subject: (d: Record<string, any>) => (d?.title ? String(d.title) : 'Você foi marcado numa observação interna'),
  displayName: 'Menção interna',
  previewData: { recipientName: 'Bruna', title: 'Gabriella marcou você em Villa Studios 2412', body: 'Pode conferir a entrega do box?', url: 'https://bwildworkflow.com' },
} satisfies TemplateEntry
