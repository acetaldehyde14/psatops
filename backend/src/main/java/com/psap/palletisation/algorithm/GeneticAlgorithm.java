package com.psap.palletisation.algorithm;

import com.psap.palletisation.algorithm.util.ScoringUtils;
import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Genetic Algorithm for palletisation.
 * Uses ExtremePointAlgorithm as the placement engine.
 * Faithful port of genetic.py.
 */
@Component
public class GeneticAlgorithm {

    static final int POPULATION_SIZE = 10;
    static final int GENERATIONS = 5;
    static final double MUTATION_RATE = 0.2;
    static final int ELITE = 2;

    private final ExtremePointAlgorithm epAlgorithm;
    private final Random random = new Random();

    public GeneticAlgorithm(ExtremePointAlgorithm epAlgorithm) {
        this.epAlgorithm = epAlgorithm;
    }

    public List<Pallet> run(List<Box> boxes, PalletSpec spec, Constraints constraints) {
        if (boxes == null || boxes.isEmpty()) return new ArrayList<>();

        int n = boxes.size();
        // Create initial population of random permutations
        List<int[]> population = new ArrayList<>();
        for (int i = 0; i < POPULATION_SIZE; i++) {
            population.add(randomChromosome(n));
        }

        List<Pallet> bestSolution = null;
        double bestScore = Double.POSITIVE_INFINITY;

        for (int gen = 0; gen < GENERATIONS; gen++) {
            // Evaluate
            List<ScoredChromosome> scored = new ArrayList<>();
            for (int[] chrom : population) {
                List<Pallet> pallets = decode(chrom, boxes, spec, constraints);
                double score = ScoringUtils.scoreSolution(pallets, constraints);
                scored.add(new ScoredChromosome(score, chrom, pallets));
            }
            scored.sort((a, b) -> Double.compare(a.score(), b.score()));

            if (scored.get(0).score() < bestScore) {
                bestScore = scored.get(0).score();
                bestSolution = scored.get(0).pallets();
            }

            // Next generation: elites + crossover + mutation
            List<int[]> nextGen = new ArrayList<>();
            for (int i = 0; i < ELITE && i < scored.size(); i++) {
                nextGen.add(scored.get(i).chromosome());
            }
            while (nextGen.size() < POPULATION_SIZE) {
                int[] p1 = scored.get(random.nextInt(Math.min(5, scored.size()))).chromosome();
                int[] p2 = scored.get(random.nextInt(Math.min(5, scored.size()))).chromosome();
                int[] child = crossover(p1, p2);
                child = mutate(child);
                nextGen.add(child);
            }
            population = nextGen;
        }

        if (bestSolution == null) {
            bestSolution = decode(population.get(0), boxes, spec, constraints);
        }
        return bestSolution;
    }

    private int[] randomChromosome(int n) {
        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < n; i++) indices.add(i);
        Collections.shuffle(indices, random);
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) arr[i] = indices.get(i);
        return arr;
    }

    private List<Pallet> decode(int[] chromosome, List<Box> boxes, PalletSpec spec, Constraints constraints) {
        List<Box> ordered = new ArrayList<>();
        for (int idx : chromosome) {
            ordered.add(new Box(boxes.get(idx))); // deep copy
        }
        return epAlgorithm.run(ordered, spec, constraints);
    }

    /** Order Crossover (OX). Ports _crossover() exactly. */
    private int[] crossover(int[] p1, int[] p2) {
        int n = p1.length;
        if (n < 2) return p1.clone();
        int a = random.nextInt(n);
        int b = random.nextInt(n);
        if (a > b) { int tmp = a; a = b; b = tmp; }

        int[] child = new int[n];
        java.util.Arrays.fill(child, -1);
        System.arraycopy(p1, a, child, a, b - a);

        // Fill remaining positions from p2 in order
        List<Integer> fill = new ArrayList<>();
        for (int val : p2) {
            boolean inChild = false;
            for (int i = a; i < b; i++) {
                if (child[i] == val) { inChild = true; break; }
            }
            if (!inChild) fill.add(val);
        }
        int j = 0;
        for (int i = 0; i < n; i++) {
            if (child[i] == -1) {
                child[i] = fill.get(j++);
            }
        }
        return child;
    }

    /** Swap mutation. Ports _mutate() exactly. */
    private int[] mutate(int[] chromosome) {
        int[] c = chromosome.clone();
        if (c.length >= 2 && random.nextDouble() < MUTATION_RATE) {
            int i = random.nextInt(c.length);
            int j = random.nextInt(c.length);
            int tmp = c[i]; c[i] = c[j]; c[j] = tmp;
        }
        return c;
    }

    private record ScoredChromosome(double score, int[] chromosome, List<Pallet> pallets) {}
}
