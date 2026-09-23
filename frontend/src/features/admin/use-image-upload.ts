import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '@/lib/http';
import { UPLOAD_FOLDERS, type UploadFolder } from './admin.types';
import { confirmUpload, createUploadSignature, uploadToCloudinary } from './uploads.api';

/**
 * O envio de fotos, do ponto de vista da tela.
 *
 * Orquestra os tres passos que `uploads.api.ts` descreve e cuida do que a
 * tela precisa saber enquanto eles acontecem: quantas faltam, qual falhou e
 * por que.
 *
 * ## Uma de cada vez, e nao todas de uma vez
 *
 * A dona escolhe cinco fotos do celular e manda. `Promise.all` subiria as
 * cinco em paralelo e seria mais rapido num escritorio — e pior no 4G da
 * loja, onde cinco envios disputando a mesma banda terminam todos juntos, no
 * fim, sem que nenhum tenha progredido antes. Em fila, a primeira foto ja
 * esta na tela enquanto a terceira sobe, e a dona ja pode reordenar.
 *
 * A fila tambem torna a falha parcial legivel: "3 de 5 enviadas, a quarta
 * falhou" e um estado que se conserta. Cinco falhas simultaneas nao.
 *
 * ## O que acontece quando o cadastro nao e salvo
 *
 * A foto fica na conta do Cloudinary sem produto nenhum apontando para ela.
 * E de proposito: apagar no `beforeunload` nao e confiavel, e uma foto orfa
 * custa centavos, enquanto apagar a foto de um cadastro que a dona ia salvar
 * custa o trabalho dela. A limpeza dessas orfas e tarefa do servidor, que
 * sabe quem referencia o que.
 */

/** O que a tela mostra enquanto sobe. */
export interface UploadProgress {
  /** Quantas ja entraram. */
  done: number;
  /** Quantas foram escolhidas nesta rodada. */
  total: number;
  /** O nome do arquivo que esta subindo agora. */
  current: string;
}

export interface ImageUpload {
  /** Manda os arquivos e devolve os `publicId`s que entraram. */
  send: (files: readonly File[]) => Promise<string[]>;
  isUploading: boolean;
  progress: UploadProgress | null;
  /** A falha da ultima rodada, ja em portugues. */
  error: string | null;
  clearError: () => void;
}

export function useImageUpload(folder: UploadFolder = UPLOAD_FOLDERS.products): ImageUpload {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guarda a rodada em andamento para que um segundo `send` — a dona escolheu
  // mais fotos antes de a fila acabar — nao entrelace as duas contagens.
  const running = useRef(false);

  const send = useCallback(
    async (files: readonly File[]): Promise<string[]> => {
      if (files.length === 0 || running.current) {
        return [];
      }

      running.current = true;
      setError(null);

      const uploaded: string[] = [];

      try {
        // A regra sugere `Promise.all`, que e exatamente o que esta fila
        // existe para evitar: cinco envios disputando o 4G da loja terminam
        // todos no fim, e a falha de um deles nao teria como ser contada. A
        // nota no topo do arquivo explica.
        /* eslint-disable no-await-in-loop */
        for (const [index, file] of files.entries()) {
          setProgress({ done: index, total: files.length, current: file.name });

          const signature = await createUploadSignature(folder, file.name);

          // O teto e conferido aqui, antes de gastar a rede: mandar 12 MB para
          // descobrir no fim que o limite e 8 e o pior jeito de contar isso
          // para quem esta no 4G.
          if (file.size > signature.maxBytes) {
            throw new Error(
              `"${file.name}" tem ${megabytes(file.size)} e o limite e ${megabytes(signature.maxBytes)}.`,
            );
          }

          const sent = await uploadToCloudinary(signature, file);
          const confirmed = await confirmUpload(sent);

          uploaded.push(confirmed.publicId);
          setProgress({ done: index + 1, total: files.length, current: file.name });
        }
        /* eslint-enable no-await-in-loop */

        return uploaded;
      } catch (cause) {
        // As que ja subiram continuam valendo e sao devolvidas: perder tres
        // fotos boas porque a quarta falhou seria punir quem nao errou.
        setError(errorMessage(cause));

        return uploaded;
      } finally {
        running.current = false;
        setProgress(null);
      }
    },
    [folder],
  );

  return {
    send,
    isUploading: progress !== null,
    progress,
    error,
    clearError: useCallback(() => {
      setError(null);
    }, []),
  };
}

/** `8388608` vira `8 MB`. Uma casa so quando ha fracao: `1,5 MB`. */
function megabytes(bytes: number): string {
  const value = bytes / 1024 / 1024;

  return `${value.toFixed(value < 10 && !Number.isInteger(value) ? 1 : 0).replace('.', ',')} MB`;
}
